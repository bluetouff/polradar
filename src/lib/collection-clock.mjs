const paris = 'Europe/Paris';
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: paris });
const zone = new Intl.DateTimeFormat('en', {
  timeZone: paris,
  timeZoneName: 'longOffset',
});
const label = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: paris,
});
const grace = 2 * 60 * 60 * 1000;

export function formatCollectionTime(instant) {
  return label.format(new Date(instant));
}

/** Scheduled times are local to Paris. Both hours are outside DST transitions. */
export function collectionClock(
  cadence,
  attempted,
  succeeded,
  now = Date.now(),
) {
  const times =
    cadence === 'sondages' ? [8, 18] : [cadence === 'editorial' ? 18 : 8];
  const midnight = Date.parse(day.format(now) + 'T00:00:00Z');
  const slots = [-1, 0, 1].flatMap((delta) =>
    times.map((hour) => {
      const nominal = midnight + (delta * 24 + hour) * 60 * 60 * 1000;
      const part = zone
        .formatToParts(nominal)
        .find(({ type }) => type === 'timeZoneName').value;
      return Date.parse(
        new Date(nominal).toISOString().slice(0, -1) +
          (part.slice(3) || '+00:00'),
      );
    }),
  );
  const due = slots.findLast((time) => time + grace <= now);
  const next = slots.find((time) => time > now);
  return {
    next: new Date(next).toISOString(),
    missedAttempt: !attempted || Date.parse(attempted) < due,
    missedSuccess: !succeeded || Date.parse(succeeded) < due,
  };
}
