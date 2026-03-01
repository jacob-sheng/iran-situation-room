import type { NewsScope } from '../types';

export type RssSource = { name: string; url: string; scope: NewsScope };

// Notes:
// - These feeds are best-effort. Client-side fetching uses rss2json/allorigins, so some sources may fail.
// - We keep a larger pool for "global" and smaller, region-focused sets for scoped views.

const GLOBAL: RssSource[] = [
  { name: 'BBC Top', url: 'https://feeds.bbci.co.uk/news/rss.xml', scope: 'global' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', scope: 'global' },
  { name: 'CNN World', url: 'http://rss.cnn.com/rss/edition_world.rss', scope: 'global' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', scope: 'global' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-top', scope: 'global' },
  { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', scope: 'global' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', scope: 'global' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', scope: 'global' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', scope: 'global' },
  { name: 'Xinhua World', url: 'http://www.xinhuanet.com/english/rss/worldrss.xml', scope: 'global' },
  { name: 'TASS', url: 'https://tass.com/rss/v2.xml', scope: 'global' },
  { name: 'RT', url: 'https://www.rt.com/rss/news/', scope: 'global' },
  { name: 'Tehran Times', url: 'https://www.tehrantimes.com/rss', scope: 'global' },
  { name: 'Jerusalem Post', url: 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', scope: 'global' },
  { name: 'USGS Earthquakes', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.atom', scope: 'global' },
  { name: 'NASA Breaking', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', scope: 'global' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', scope: 'global' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', scope: 'global' },
  { name: 'Nature News', url: 'https://www.nature.com/nature/articles?type=news&format=rss', scope: 'global' },
  { name: 'WHO News', url: 'https://www.who.int/feeds/entity/mediacentre/news/en/rss.xml', scope: 'global' },
  { name: 'ReliefWeb Updates', url: 'https://reliefweb.int/updates/rss.xml', scope: 'global' },
];

const AMERICAS: RssSource[] = [
  { name: 'BBC US & Canada', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', scope: 'americas' },
  { name: 'BBC Latin America', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', scope: 'americas' },
  { name: 'CNN World', url: 'http://rss.cnn.com/rss/edition_world.rss', scope: 'americas' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', scope: 'americas' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', scope: 'americas' },
];

const EUROPE: RssSource[] = [
  { name: 'BBC Europe', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', scope: 'europe' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-top', scope: 'europe' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', scope: 'europe' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', scope: 'europe' },
];

const AFRICA: RssSource[] = [
  { name: 'BBC Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', scope: 'africa' },
  { name: 'UN News', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', scope: 'africa' },
  { name: 'ReliefWeb Updates', url: 'https://reliefweb.int/updates/rss.xml', scope: 'africa' },
];

const MIDDLE_EAST: RssSource[] = [
  { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', scope: 'middle_east' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', scope: 'middle_east' },
  { name: 'Tehran Times', url: 'https://www.tehrantimes.com/rss', scope: 'middle_east' },
  { name: 'Jerusalem Post', url: 'https://www.jpost.com/Rss/RssFeedsHeadlines.aspx', scope: 'middle_east' },
];

const ASIA_PACIFIC: RssSource[] = [
  { name: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', scope: 'asia_pacific' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', scope: 'asia_pacific' },
  { name: 'Xinhua World', url: 'http://www.xinhuanet.com/english/rss/worldrss.xml', scope: 'asia_pacific' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', scope: 'asia_pacific' },
];

export const RSS_SOURCES_BY_SCOPE: Record<NewsScope, RssSource[]> = {
  global: GLOBAL,
  americas: AMERICAS,
  europe: EUROPE,
  africa: AFRICA,
  middle_east: MIDDLE_EAST,
  asia_pacific: ASIA_PACIFIC,
};
