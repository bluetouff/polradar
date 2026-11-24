package main

import (
	"sort"
	"sync"
	"testing"
	"time"
)

// Each operation includes mutex waiting; the separate wall clock measures throughput.
func BenchmarkUsage(b *testing.B) {
	for _, parallel := range []struct {
		name string
		n    int
	}{{"serial", 1}, {"concurrent-12", 12}} {
		b.Run(parallel.name, func(b *testing.B) {
			u := openUsage(b.TempDir(), time.Now())
			if u.unavailable {
				b.Fatal("storage")
			}
			samples := make([]time.Duration, b.N)
			var wg sync.WaitGroup
			b.ResetTimer()
			for worker := 0; worker < parallel.n; worker++ {
				wg.Add(1)
				go func(k int) {
					defer wg.Done()
					for i := k; i < b.N; i += parallel.n {
						start := time.Now()
						u.record("polradar_corpus", counts{Success: 1}, start)
						samples[i] = time.Since(start)
					}
				}(worker)
			}
			wg.Wait()
			b.StopTimer()
			sort.Slice(samples, func(i, j int) bool { return samples[i] < samples[j] })
			for _, q := range []struct {
				name string
				p    int
			}{{"p50-us", 50}, {"p95-us", 95}, {"p99-us", 99}} {
				b.ReportMetric(float64(samples[(len(samples)-1)*q.p/100].Nanoseconds())/1e3, q.name)
			}
		})
	}
}
