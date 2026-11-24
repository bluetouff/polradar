package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const endpoint = "/api/mcp"
const statsPath = "/api/mcp-stats.json"
const socketPath = "/run/polradar-mcp.sock"
const maxBody = 16 << 10

type output struct {
	Updated string `json:"corpusVerifieLe"`
	Commit  string `json:"revisionDuSite"`
	Empty   bool   `json:"sansResultat"`
	Data    any    `json:"donnees"`
}

func register[I any](server *mcp.Server, data *store, name, description string, call func(*snapshot, I) (any, bool, error)) {
	off := false
	mcp.AddTool(server, &mcp.Tool{Name: name, Description: description, Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true, IdempotentHint: true, DestructiveHint: &off, OpenWorldHint: &off}}, func(_ context.Context, _ *mcp.CallToolRequest, args I) (*mcp.CallToolResult, output, error) {
		c, err := data.load()
		if err != nil {
			return nil, output{}, invalidCorpus
		}
		value, empty, err := call(c, args)
		if err != nil {
			return nil, output{}, err
		}
		return nil, output{c.Meta.Updated, c.commit, empty, value}, nil
	})
}

func protocol(data *store, activity *usage) http.Handler {
	quiet := slog.New(slog.NewTextHandler(io.Discard, nil))
	server := mcp.NewServer(&mcp.Implementation{Name: "polradar", Title: "Polradar", Version: "1.0.0", WebsiteURL: site + "/mcp/"}, &mcp.ServerOptions{Logger: quiet, Instructions: "Les outils consultent le corpus public de la présidentielle française. Citez la source et son passage. Le statut et l’auteur distinguent les déclarations individuelles, les programmes collectifs, les orientations et les archives."})
	register(server, data, "polradar_search", "Rechercher des propositions par mots, candidature, thème ou statut avec lien vers la fiche et sa source.", (*snapshot).search)
	register(server, data, "polradar_measure", "Lire le texte, l’auteur, les chiffres disponibles et toutes les références d’une mesure identifiée.", (*snapshot).detail)
	register(server, data, "polradar_candidates", "Lister les candidatures suivies avec leur statut documenté. Les retraits sont disponibles en option.", (*snapshot).listPeople)
	register(server, data, "polradar_corpus", "Consulter les effectifs par type de fiche et les identifiants des thèmes.", (*snapshot).counts)
	register(server, data, "polradar_donnees", "Consulter les sondages, les indicateurs économiques, l’agenda, les budgets et les marchés prédictifs. Choisissez une collection, puis un identifiant pour lire les chiffres, les dates et les sources.", (*snapshot).publicData)
	// Known, dispatched tools only. Discovery, unknown names and report reads never increment the public counters.
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			r, err := next(ctx, method, req)
			if method == "tools/call" {
				if params, ok := req.GetParams().(*mcp.CallToolParamsRaw); ok {
					c := counts{Error: 1}
					if result, ok := r.(*mcp.CallToolResult); ok && err == nil && !result.IsError {
						c = counts{Success: 1}
						var v struct {
							Empty bool `json:"sansResultat"`
						}
						if raw, ok := result.StructuredContent.(json.RawMessage); ok && json.Unmarshal(raw, &v) == nil && v.Empty {
							c = counts{Empty: 1}
						}
					}
					activity.record(params.Name, c, time.Now())
				}
			}
			return r, err
		}
	})
	return mcp.NewStreamableHTTPHandler(func(_ *http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true, MaxRequestBodyBytes: maxBody, PropagateRequestCancellation: true, Logger: quiet})
}

type limits struct {
	mu      sync.Mutex
	minute  int64
	total   int
	clients map[netip.Addr]int
}

func (l *limits) allow(client string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	m := now.Unix() / 60
	if m != l.minute || l.clients == nil {
		l.minute = m
		l.total = 0
		l.clients = map[netip.Addr]int{}
	}
	// Apache overwrites this header using REMOTE_ADDR on the private Unix socket.
	// Entries exist only for the current minute and never enter the statistics.
	addr, _ := netip.ParseAddr(client)
	addr = addr.Unmap()
	if l.total >= 1200 || l.clients[addr] >= 90 {
		return false
	}
	l.total++
	l.clients[addr]++
	return true
}

func acceptsMCP(values []string) bool {
	var jsonOK, streamOK bool
	for _, line := range values {
		for _, item := range strings.Split(line, ",") {
			media, params, err := mime.ParseMediaType(strings.TrimSpace(item))
			if err != nil {
				continue
			}
			if q, present := params["q"]; present {
				weight, err := strconv.ParseFloat(q, 64)
				if err != nil || !(weight > 0 && weight <= 1) {
					continue
				}
			}
			switch media {
			case "application/json":
				jsonOK = true
			case "text/event-stream":
				streamOK = true
			}
		}
	}
	return jsonOK && streamOK
}

func handler(data *store, activity *usage) http.Handler {
	transport := protocol(data, activity)
	limit := new(limits)
	slots := make(chan struct{}, 24)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if (r.Host != "polradar.fr" && r.Host != "polradar.fr:443") || (len(r.Header.Values("Origin")) > 0 && (len(r.Header.Values("Origin")) != 1 || r.Header.Get("Origin") != site)) {
			http.Error(w, "Origine refusée.", 403)
			return
		}
		if r.URL.RawQuery != "" || r.URL.ForceQuery || r.URL.EscapedPath() != r.URL.Path {
			http.NotFound(w, r)
			return
		}
		allowed := "POST"
		switch r.URL.Path {
		case statsPath:
			allowed = "GET"
		case endpoint:
		default:
			http.NotFound(w, r)
			return
		}
		if r.Method != allowed {
			w.Header().Set("Allow", allowed)
			w.WriteHeader(405)
			return
		}
		if !limit.allow(r.Header.Get("X-Polradar-Client"), time.Now()) {
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(429)
			return
		}
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		default:
			w.Header().Set("Retry-After", "2")
			w.WriteHeader(503)
			return
		}
		if r.URL.Path == statsPath {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			v, err := activity.public(time.Now())
			if err != nil {
				w.WriteHeader(503)
				io.WriteString(w, `{"status":"unavailable"}`)
				return
			}
			json.NewEncoder(w).Encode(v)
			return
		}
		media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || media != "application/json" || (params["charset"] != "" && !strings.EqualFold(params["charset"], "utf-8")) || r.Header.Get("Content-Encoding") != "" {
			w.WriteHeader(415)
			return
		}
		if r.ContentLength > maxBody {
			w.WriteHeader(413)
			return
		}
		if !acceptsMCP(r.Header.Values("Accept")) {
			w.WriteHeader(http.StatusNotAcceptable)
			return
		}
		transport.ServeHTTP(w, r)
	})
}

func inherited() (net.Listener, error) {
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "1" {
		return nil, errors.New("Socket systemd requise.")
	}
	f := os.NewFile(3, "polradar-mcp.socket")
	if f == nil {
		return nil, errors.New("Socket absente.")
	}
	defer f.Close()
	ln, err := net.FileListener(f)
	if err != nil {
		return nil, err
	}
	if _, ok := ln.(*net.UnixListener); !ok || ln.Addr().String() != socketPath {
		ln.Close()
		return nil, errors.New("Socket inattendue.")
	}
	return ln, nil
}
func main() {
	ln, err := inherited()
	if err != nil {
		log.Fatal("Socket systemd indisponible.")
	}
	data := &store{root: "/var/www/html/polradar"}
	activity := openUsage("/var/lib/polradar-mcp", time.Now())
	if activity.unavailable {
		log.Print("Compteurs indisponibles.")
	}
	srv := &http.Server{Handler: handler(data, activity), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 15 * time.Second, MaxHeaderBytes: 16 << 10, ErrorLog: log.New(io.Discard, "", 0)}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdown)
	}()
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		log.Fatal("Service MCP interrompu.")
	}
}
