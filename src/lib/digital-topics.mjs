/**
 * @param {{measures?: string[], groups?: {measures: string[]}[]}} topic
 * @returns {string[]}
 */
export function digitalMeasureIds(topic) {
  return (
    topic.groups?.flatMap((group) => group.measures) ?? topic.measures ?? []
  );
}
