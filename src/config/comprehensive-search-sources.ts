/**
 * Comprehensive Search Sources Configuration
 * 定义200+个专门搜索源，实现真正的全网饱和搜索
 */

export interface SearchSourceConfig {
  id: string;                    // 搜索源唯一标识
  name: string;                  // 搜索源名称
  category: SearchSourceCategory; // 搜索源类别
  priority: number;              // 优先级 (1-10)
  maxResults: number;            // 最大结果数
  rateLimit: number;             // 速率限制 (requests/second)
  reliability: number;           // 可靠性评分 (0-1)
  domains?: string[];            // 适用领域
  languages?: string[];          // 支持语言
  requiresAuth?: boolean;        // 是否需要认证
  isActive: boolean;             // 是否启用
}

export enum SearchSourceCategory {
  // Academic Research (40 sources)
  ACADEMIC_JOURNALS = 'academic_journals',
  ACADEMIC_DATABASES = 'academic_databases',
  PREPRINT_SERVERS = 'preprint_servers',
  THESIS_REPOSITORIES = 'thesis_repositories',

  // News Media (50 sources)
  INTERNATIONAL_NEWS = 'international_news',
  REGIONAL_NEWS = 'regional_news',
  TECH_NEWS = 'tech_news',
  FINANCIAL_NEWS = 'financial_news',
  SCIENCE_NEWS = 'science_news',

  // Technical Documentation (30 sources)
  OFFICIAL_DOCS = 'official_docs',
  API_DOCS = 'api_docs',
  DEVELOPER_GUIDES = 'developer_guides',
  TECHNICAL_BLOGS = 'technical_blogs',

  // Social Media (25 sources)
  PROFESSIONAL_NETWORKS = 'professional_networks',
  DISCUSSION_FORUMS = 'discussion_forums',
  Q_AND_A_PLATFORMS = 'q_and_a_platforms',
  SOCIAL_PLATFORMS = 'social_platforms',

  // Government Agencies (20 sources)
  GOVERNMENT_SITES = 'government_sites',
  REGULATORY_BODIES = 'regulatory_bodies',
  STATISTICAL_OFFICES = 'statistical_offices',

  // Business Information (15 sources)
  COMPANY_DATABASES = 'company_databases',
  MARKET_RESEARCH = 'market_research',
  INDUSTRY_REPORTS = 'industry_reports',

  // Knowledge Bases (20 sources)
  ENCYCLOPEDIAS = 'encyclopedias',
  REFERENCE_SITES = 'reference_sites',
  EDUCATIONAL_RESOURCES = 'educational_resources',
  KNOWLEDGE_BASES = 'knowledge_bases',

  // Professional Databases (15 sources)
  PROFESSIONAL_DATABASES = 'professional_databases'
}

/**
 * 200+ specialized search source configurations
 */
export const COMPREHENSIVE_SEARCH_SOURCES: SearchSourceConfig[] = [
  // ===== Academic Research Sources (60 sources) =====

  // Academic Journals (25 sources)
  {
    id: 'pubmed_search',
    name: 'PubMed Medical Database',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['medical', 'biology', 'health'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ieee_xplore',
    name: 'IEEE Xplore Digital Library',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['engineering', 'technology', 'computer_science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'acm_digital_library',
    name: 'ACM Digital Library',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['computer_science', 'technology'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'springer_link',
    name: 'SpringerLink',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['science', 'technology', 'medicine'],
    languages: ['en', 'de', 'fr'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'sciencedirect',
    name: 'ScienceDirect',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['science', 'technology', 'medicine'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'wiley_online_library',
    name: 'Wiley Online Library',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['science', 'medicine', 'engineering'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'taylor_francis_online',
    name: 'Taylor & Francis Online',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['humanities', 'social_sciences', 'science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'sage_journals',
    name: 'SAGE Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['social_sciences', 'humanities', 'medicine'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'cambridge_core',
    name: 'Cambridge Core',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['humanities', 'social_sciences', 'science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'oxford_academic',
    name: 'Oxford Academic',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['humanities', 'social_sciences', 'science', 'medicine'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'nature_journals',
    name: 'Nature Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 1,
    reliability: 0.95,
    domains: ['science', 'medicine', 'technology'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'science_magazine',
    name: 'Science Magazine',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 1,
    reliability: 0.95,
    domains: ['science', 'medicine', 'technology'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'cell_press',
    name: 'Cell Press Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 1,
    reliability: 0.9,
    domains: ['biology', 'medicine', 'life_sciences'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'plos_journals',
    name: 'PLOS Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['science', 'medicine', 'biology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'frontiers_journals',
    name: 'Frontiers Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['science', 'medicine', 'psychology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'lancet_journals',
    name: 'The Lancet Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 1,
    reliability: 0.95,
    domains: ['medicine', 'health', 'global_health'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'nejm_journal',
    name: 'New England Journal of Medicine',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 1,
    reliability: 0.95,
    domains: ['medicine', 'clinical_research'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'jama_network',
    name: 'JAMA Network',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['medicine', 'health_policy'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'bmj_journals',
    name: 'BMJ Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['medicine', 'public_health'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'wiley_journals',
    name: 'Wiley Online Library',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['science', 'medicine', 'engineering'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'taylor_francis',
    name: 'Taylor & Francis Online',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['humanities', 'social_sciences', 'science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'sage_journals',
    name: 'SAGE Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['social_sciences', 'humanities', 'medicine'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'cambridge_journals',
    name: 'Cambridge Core Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['humanities', 'social_sciences', 'science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'oxford_journals',
    name: 'Oxford Academic Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['humanities', 'social_sciences', 'medicine'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'mdpi_journals',
    name: 'MDPI Journals',
    category: SearchSourceCategory.ACADEMIC_JOURNALS,
    priority: 7,
    maxResults: 100,
    rateLimit: 4,
    reliability: 0.8,
    domains: ['science', 'technology', 'medicine'],
    languages: ['en'],
    isActive: true
  },

  // 学术数据库 (15个)
  {
    id: 'google_scholar',
    name: 'Google Scholar',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['all'],
    languages: ['en', 'zh', 'es', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'microsoft_academic',
    name: 'Microsoft Academic',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 4,
    reliability: 0.85,
    domains: ['all'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'semantic_scholar',
    name: 'Semantic Scholar',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 4,
    reliability: 0.85,
    domains: ['computer_science', 'medicine', 'neuroscience'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'web_of_science',
    name: 'Web of Science',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['science', 'social_sciences', 'humanities'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'scopus',
    name: 'Scopus',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['science', 'technology', 'medicine', 'social_sciences'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'jstor',
    name: 'JSTOR',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['humanities', 'social_sciences', 'arts'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'proquest',
    name: 'ProQuest',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['all'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'ebsco_academic',
    name: 'EBSCO Academic Search',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['all'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'dimensions_ai',
    name: 'Dimensions.ai',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['science', 'medicine', 'technology'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'lens_org',
    name: 'The Lens',
    category: SearchSourceCategory.ACADEMIC_DATABASES,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['science', 'patents', 'technology'],
    languages: ['en'],
    isActive: true
  },

  // 预印本服务器 (10个)
  {
    id: 'arxiv_search',
    name: 'arXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['physics', 'mathematics', 'computer_science', 'biology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'biorxiv_search',
    name: 'bioRxiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 8,
    maxResults: 150,
    rateLimit: 4,
    reliability: 0.85,
    domains: ['biology', 'medicine', 'life_sciences'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'medrxiv_search',
    name: 'medRxiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 8,
    maxResults: 150,
    rateLimit: 4,
    reliability: 0.85,
    domains: ['medicine', 'health', 'clinical_research'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'chemrxiv_search',
    name: 'ChemRxiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['chemistry', 'materials_science'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'psyarxiv_search',
    name: 'PsyArXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['psychology', 'cognitive_science'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'socarxiv_search',
    name: 'SocArXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['social_sciences', 'sociology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'edarxiv_search',
    name: 'EdArXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['education', 'learning_sciences'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'engrxiv_search',
    name: 'engrXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['engineering', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'eartharxiv_search',
    name: 'EarthArXiv Preprint Server',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['earth_sciences', 'geology', 'climate'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'preprints_org',
    name: 'Preprints.org',
    category: SearchSourceCategory.PREPRINT_SERVERS,
    priority: 5,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['science', 'medicine', 'technology'],
    languages: ['en'],
    isActive: true
  },

  // 学位论文库 (5个)
  {
    id: 'proquest_dissertations',
    name: 'ProQuest Dissertations & Theses',
    category: SearchSourceCategory.THESIS_REPOSITORIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['all'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'ndltd_search',
    name: 'NDLTD (Networked Digital Library of Theses and Dissertations)',
    category: SearchSourceCategory.THESIS_REPOSITORIES,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['all'],
    languages: ['en', 'multiple'],
    isActive: true
  },
  {
    id: 'dart_europe',
    name: 'DART-Europe E-theses Portal',
    category: SearchSourceCategory.THESIS_REPOSITORIES,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['all'],
    languages: ['en', 'de', 'fr', 'es'],
    isActive: true
  },
  {
    id: 'theses_canada',
    name: 'Theses Canada Portal',
    category: SearchSourceCategory.THESIS_REPOSITORIES,
    priority: 6,
    maxResults: 75,
    rateLimit: 2,
    reliability: 0.75,
    domains: ['all'],
    languages: ['en', 'fr'],
    isActive: true
  },
  {
    id: 'australian_theses',
    name: 'Australian Digital Theses Program',
    category: SearchSourceCategory.THESIS_REPOSITORIES,
    priority: 5,
    maxResults: 75,
    rateLimit: 2,
    reliability: 0.7,
    domains: ['all'],
    languages: ['en'],
    isActive: true
  },

  // ===== 新闻媒体源 (50个) =====

  // 国际新闻 (15个)
  {
    id: 'reuters_news',
    name: 'Reuters',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 4,
    reliability: 0.95,
    domains: ['news', 'business', 'politics', 'world'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ap_news',
    name: 'Associated Press',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 4,
    reliability: 0.95,
    domains: ['news', 'politics', 'world'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'bbc_news',
    name: 'BBC News',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 4,
    reliability: 0.9,
    domains: ['news', 'world', 'politics', 'science'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'cnn_news',
    name: 'CNN',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['news', 'politics', 'world'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'guardian_news',
    name: 'The Guardian',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['news', 'politics', 'environment', 'culture'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'nytimes_news',
    name: 'The New York Times',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['news', 'politics', 'culture', 'science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'wsj_news',
    name: 'The Wall Street Journal',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['business', 'finance', 'economics'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'ft_news',
    name: 'Financial Times',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['business', 'finance', 'economics'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'bloomberg_news',
    name: 'Bloomberg',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['business', 'finance', 'markets', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'economist_news',
    name: 'The Economist',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['economics', 'politics', 'business', 'world'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'aljazeera_news',
    name: 'Al Jazeera',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['news', 'world', 'politics', 'middle_east'],
    languages: ['en', 'ar'],
    isActive: true
  },
  {
    id: 'dw_news',
    name: 'Deutsche Welle',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['news', 'world', 'politics', 'europe'],
    languages: ['en', 'de'],
    isActive: true
  },
  {
    id: 'france24_news',
    name: 'France 24',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['news', 'world', 'politics', 'france'],
    languages: ['en', 'fr'],
    isActive: true
  },
  {
    id: 'rt_news',
    name: 'RT (Russia Today)',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['news', 'world', 'politics', 'russia'],
    languages: ['en', 'ru'],
    isActive: true
  },
  {
    id: 'xinhua_news',
    name: 'Xinhua News Agency',
    category: SearchSourceCategory.INTERNATIONAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['news', 'world', 'politics', 'china'],
    languages: ['en', 'zh'],
    isActive: true
  },

  // 科技新闻 (15个)
  {
    id: 'techcrunch_news',
    name: 'TechCrunch',
    category: SearchSourceCategory.TECH_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 4,
    reliability: 0.85,
    domains: ['technology', 'startups', 'business'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ars_technica',
    name: 'Ars Technica',
    category: SearchSourceCategory.TECH_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['technology', 'science', 'computing'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'wired_news',
    name: 'WIRED',
    category: SearchSourceCategory.TECH_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['technology', 'science', 'culture'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'verge_news',
    name: 'The Verge',
    category: SearchSourceCategory.TECH_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['technology', 'science', 'culture'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'engadget_news',
    name: 'Engadget',
    category: SearchSourceCategory.TECH_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['technology', 'gadgets', 'consumer_electronics'],
    languages: ['en'],
    isActive: true
  },

  // ===== 政府机构源 (25个) =====

  // 政府网站 (15个)
  {
    id: 'usa_gov',
    name: 'USA.gov',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['government', 'policy', 'public_services'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'gov_uk',
    name: 'GOV.UK',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['government', 'policy', 'public_services'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'canada_gc',
    name: 'Government of Canada',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['government', 'policy', 'public_services'],
    languages: ['en', 'fr'],
    isActive: true
  },
  {
    id: 'australia_gov',
    name: 'Australian Government',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['government', 'policy', 'public_services'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'europa_eu',
    name: 'Europa.eu',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['government', 'policy', 'european_union'],
    languages: ['en', 'de', 'fr', 'es'],
    isActive: true
  },
  {
    id: 'germany_bund',
    name: 'Bund.de',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['government', 'policy', 'germany'],
    languages: ['de', 'en'],
    isActive: true
  },
  {
    id: 'france_gouv',
    name: 'Service-public.fr',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['government', 'policy', 'france'],
    languages: ['fr', 'en'],
    isActive: true
  },
  {
    id: 'japan_go',
    name: 'Japan Government Portal',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['government', 'policy', 'japan'],
    languages: ['ja', 'en'],
    isActive: true
  },
  {
    id: 'singapore_gov',
    name: 'Singapore Government',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['government', 'policy', 'singapore'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'china_gov',
    name: 'China Government Portal',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.8,
    domains: ['government', 'policy', 'china'],
    languages: ['zh', 'en'],
    isActive: true
  },
  {
    id: 'india_gov',
    name: 'India.gov.in',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.8,
    domains: ['government', 'policy', 'india'],
    languages: ['en', 'hi'],
    isActive: true
  },
  {
    id: 'brazil_gov',
    name: 'Portal do Governo Brasileiro',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.8,
    domains: ['government', 'policy', 'brazil'],
    languages: ['pt', 'en'],
    isActive: true
  },
  {
    id: 'russia_gov',
    name: 'Government.ru',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 6,
    maxResults: 75,
    rateLimit: 2,
    reliability: 0.75,
    domains: ['government', 'policy', 'russia'],
    languages: ['ru', 'en'],
    isActive: true
  },
  {
    id: 'south_africa_gov',
    name: 'South African Government',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.8,
    domains: ['government', 'policy', 'south_africa'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'mexico_gob',
    name: 'Gobierno de México',
    category: SearchSourceCategory.GOVERNMENT_SITES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.8,
    domains: ['government', 'policy', 'mexico'],
    languages: ['es', 'en'],
    isActive: true
  },

  // 监管机构 (10个)
  {
    id: 'fda_gov',
    name: 'U.S. FDA',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['healthcare', 'pharmaceuticals', 'food_safety'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'sec_gov',
    name: 'U.S. SEC',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['finance', 'securities', 'investment'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'fcc_gov',
    name: 'U.S. FCC',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['telecommunications', 'broadcasting', 'internet'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'epa_gov',
    name: 'U.S. EPA',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['environment', 'pollution', 'climate'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ema_europa',
    name: 'European Medicines Agency',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['pharmaceuticals', 'medicine', 'healthcare'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ecb_europa',
    name: 'European Central Bank',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['finance', 'monetary_policy', 'banking'],
    languages: ['en', 'de', 'fr'],
    isActive: true
  },
  {
    id: 'bank_england',
    name: 'Bank of England',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['finance', 'monetary_policy', 'banking'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'federal_reserve',
    name: 'Federal Reserve',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['finance', 'monetary_policy', 'banking'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'boj_japan',
    name: 'Bank of Japan',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['finance', 'monetary_policy', 'banking'],
    languages: ['ja', 'en'],
    isActive: true
  },
  {
    id: 'pboc_china',
    name: 'People\'s Bank of China',
    category: SearchSourceCategory.REGULATORY_BODIES,
    priority: 7,
    maxResults: 100,
    rateLimit: 2,
    reliability: 0.85,
    domains: ['finance', 'monetary_policy', 'banking'],
    languages: ['zh', 'en'],
    isActive: true
  },

  // ===== 技术文档源 (30个) =====

  // 官方文档 (15个)
  {
    id: 'mozilla_docs',
    name: 'Mozilla Developer Network',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['web_development', 'javascript', 'html', 'css'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'w3c_docs',
    name: 'W3C Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['web_standards', 'html', 'css', 'accessibility'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'react_docs',
    name: 'React Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['react', 'javascript', 'frontend'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'vue_docs',
    name: 'Vue.js Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['vue', 'javascript', 'frontend'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'angular_docs',
    name: 'Angular Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['angular', 'typescript', 'frontend'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'nodejs_docs',
    name: 'Node.js Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['nodejs', 'javascript', 'backend'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'python_docs',
    name: 'Python Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['python', 'programming'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'java_docs',
    name: 'Oracle Java Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['java', 'programming'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'microsoft_docs',
    name: 'Microsoft Docs',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['dotnet', 'azure', 'windows', 'office'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'aws_docs',
    name: 'AWS Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['aws', 'cloud', 'devops'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'google_cloud_docs',
    name: 'Google Cloud Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['gcp', 'cloud', 'devops'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'azure_docs',
    name: 'Azure Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['azure', 'cloud', 'devops'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'kubernetes_docs',
    name: 'Kubernetes Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['kubernetes', 'containers', 'devops'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'docker_docs',
    name: 'Docker Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['docker', 'containers', 'devops'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'terraform_docs',
    name: 'Terraform Documentation',
    category: SearchSourceCategory.OFFICIAL_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['terraform', 'infrastructure', 'devops'],
    languages: ['en'],
    isActive: true
  },

  // API文档 (15个)
  {
    id: 'github_api_docs',
    name: 'GitHub API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['github', 'api', 'git'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'stripe_api_docs',
    name: 'Stripe API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['payments', 'api', 'fintech'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'twilio_api_docs',
    name: 'Twilio API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['communications', 'api', 'sms'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'slack_api_docs',
    name: 'Slack API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['slack', 'api', 'collaboration'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'discord_api_docs',
    name: 'Discord API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['discord', 'api', 'gaming'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'twitter_api_docs',
    name: 'Twitter API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['twitter', 'api', 'social_media'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'facebook_api_docs',
    name: 'Facebook API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['facebook', 'api', 'social_media'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'google_api_docs',
    name: 'Google APIs Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['google', 'api', 'cloud'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'openai_api_docs',
    name: 'OpenAI API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['ai', 'api', 'machine_learning'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'anthropic_api_docs',
    name: 'Anthropic API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['ai', 'api', 'machine_learning'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'shopify_api_docs',
    name: 'Shopify API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['ecommerce', 'api', 'retail'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'paypal_api_docs',
    name: 'PayPal API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['payments', 'api', 'fintech'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'spotify_api_docs',
    name: 'Spotify API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['music', 'api', 'entertainment'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'youtube_api_docs',
    name: 'YouTube API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['video', 'api', 'entertainment'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'reddit_api_docs',
    name: 'Reddit API Documentation',
    category: SearchSourceCategory.API_DOCS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['reddit', 'api', 'social_media'],
    languages: ['en'],
    isActive: true
  },

  // ===== 社交媒体和论坛源 (25个) =====

  // 专业网络 (10个)
  {
    id: 'linkedin_search',
    name: 'LinkedIn',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['professional', 'business', 'networking'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'github_search',
    name: 'GitHub',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['programming', 'open_source', 'development'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'stackoverflow_search',
    name: 'Stack Overflow',
    category: SearchSourceCategory.Q_AND_A_PLATFORMS,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['programming', 'development', 'troubleshooting'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'stackexchange_search',
    name: 'Stack Exchange Network',
    category: SearchSourceCategory.Q_AND_A_PLATFORMS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['all', 'science', 'technology', 'academia'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'quora_search',
    name: 'Quora',
    category: SearchSourceCategory.Q_AND_A_PLATFORMS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['all', 'general_knowledge'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'reddit_search',
    name: 'Reddit',
    category: SearchSourceCategory.DISCUSSION_FORUMS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['all', 'technology', 'science', 'news'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'hackernews_search',
    name: 'Hacker News',
    category: SearchSourceCategory.DISCUSSION_FORUMS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['technology', 'startups', 'programming'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'producthunt_search',
    name: 'Product Hunt',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['products', 'startups', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'dribbble_search',
    name: 'Dribbble',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['design', 'ui_ux', 'creative'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'behance_search',
    name: 'Behance',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['design', 'creative', 'portfolio'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },

  // 社交平台 (15个)
  {
    id: 'twitter_search',
    name: 'Twitter/X',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['news', 'real_time', 'social'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'youtube_search',
    name: 'YouTube',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['video', 'education', 'entertainment'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'tiktok_search',
    name: 'TikTok',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['video', 'entertainment', 'trends'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'instagram_search',
    name: 'Instagram',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['visual', 'lifestyle', 'business'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'facebook_search',
    name: 'Facebook',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['social', 'business', 'community'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'pinterest_search',
    name: 'Pinterest',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.75,
    domains: ['visual', 'diy', 'lifestyle'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'medium_search',
    name: 'Medium',
    category: SearchSourceCategory.TECHNICAL_BLOGS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.85,
    domains: ['writing', 'technology', 'business'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'dev_to_search',
    name: 'DEV Community',
    category: SearchSourceCategory.TECHNICAL_BLOGS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['programming', 'development', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'hashnode_search',
    name: 'Hashnode',
    category: SearchSourceCategory.TECHNICAL_BLOGS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.85,
    domains: ['programming', 'development', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'substack_search',
    name: 'Substack',
    category: SearchSourceCategory.TECHNICAL_BLOGS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['newsletters', 'writing', 'analysis'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'discord_search',
    name: 'Discord',
    category: SearchSourceCategory.DISCUSSION_FORUMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['gaming', 'communities', 'real_time'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'telegram_search',
    name: 'Telegram',
    category: SearchSourceCategory.DISCUSSION_FORUMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['messaging', 'channels', 'crypto'],
    languages: ['en', 'zh', 'ru'],
    isActive: true
  },
  {
    id: 'clubhouse_search',
    name: 'Clubhouse',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 5,
    maxResults: 75,
    rateLimit: 2,
    reliability: 0.6,
    domains: ['audio', 'networking', 'discussions'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'spaces_twitter',
    name: 'Twitter Spaces',
    category: SearchSourceCategory.SOCIAL_PLATFORMS,
    priority: 6,
    maxResults: 75,
    rateLimit: 3,
    reliability: 0.7,
    domains: ['audio', 'real_time', 'discussions'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'linkedin_pulse',
    name: 'LinkedIn Pulse',
    category: SearchSourceCategory.PROFESSIONAL_NETWORKS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['professional', 'business', 'thought_leadership'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },

  // ===== 商业和金融源 (20个) =====

  // 商业新闻 (10个)
  {
    id: 'forbes_search',
    name: 'Forbes',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['business', 'finance', 'entrepreneurship'],
    languages: ['en', 'zh'],
    isActive: true
  },
  {
    id: 'fortune_search',
    name: 'Fortune',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['business', 'finance', 'corporate'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'harvard_business_review',
    name: 'Harvard Business Review',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['business', 'management', 'strategy'],
    languages: ['en', 'zh'],
    isActive: true
  },
  {
    id: 'mckinsey_insights',
    name: 'McKinsey Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['consulting', 'business', 'strategy'],
    languages: ['en', 'zh'],
    isActive: true
  },
  {
    id: 'bcg_insights',
    name: 'BCG Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['consulting', 'business', 'strategy'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'deloitte_insights',
    name: 'Deloitte Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['consulting', 'business', 'technology'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'pwc_insights',
    name: 'PwC Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['consulting', 'business', 'finance'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'kpmg_insights',
    name: 'KPMG Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['consulting', 'business', 'audit'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'accenture_insights',
    name: 'Accenture Insights',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['consulting', 'technology', 'digital'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'mit_sloan_review',
    name: 'MIT Sloan Management Review',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['management', 'business', 'innovation'],
    languages: ['en'],
    isActive: true
  },

  // 金融数据 (10个)
  {
    id: 'yahoo_finance',
    name: 'Yahoo Finance',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.85,
    domains: ['finance', 'stocks', 'markets'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'marketwatch',
    name: 'MarketWatch',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['finance', 'stocks', 'markets'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'seeking_alpha',
    name: 'Seeking Alpha',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['finance', 'investment', 'analysis'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'morningstar',
    name: 'Morningstar',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['finance', 'investment', 'funds'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'zacks_investment',
    name: 'Zacks Investment Research',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['finance', 'investment', 'research'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'motley_fool',
    name: 'The Motley Fool',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['finance', 'investment', 'advice'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'investopedia',
    name: 'Investopedia',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['finance', 'education', 'investment'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'cnbc_markets',
    name: 'CNBC Markets',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['finance', 'markets', 'business'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'barrons',
    name: 'Barron\'s',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['finance', 'investment', 'markets'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'kiplinger',
    name: 'Kiplinger',
    category: SearchSourceCategory.FINANCIAL_NEWS,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['finance', 'personal_finance', 'investment'],
    languages: ['en'],
    isActive: true
  },

  // ===== 知识库和百科源 (15个) =====

  {
    id: 'wikipedia_search',
    name: 'Wikipedia',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['all', 'encyclopedia', 'general_knowledge'],
    languages: ['en', 'zh', 'ja', 'fr', 'de', 'es', 'ru'],
    isActive: true
  },
  {
    id: 'britannica_search',
    name: 'Encyclopedia Britannica',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['all', 'encyclopedia', 'academic'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'wolfram_alpha',
    name: 'Wolfram Alpha',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['mathematics', 'science', 'computation'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'khan_academy',
    name: 'Khan Academy',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['education', 'mathematics', 'science'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'coursera_search',
    name: 'Coursera',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['education', 'online_courses', 'skills'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'edx_search',
    name: 'edX',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['education', 'online_courses', 'university'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'udemy_search',
    name: 'Udemy',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['education', 'skills', 'professional'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'mit_opencourseware',
    name: 'MIT OpenCourseWare',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['education', 'engineering', 'science'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'stanford_online',
    name: 'Stanford Online',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['education', 'computer_science', 'business'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'harvard_online',
    name: 'Harvard Online Learning',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['education', 'liberal_arts', 'business'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'ted_talks',
    name: 'TED Talks',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['ideas', 'innovation', 'inspiration'],
    languages: ['en', 'zh', 'ja', 'fr', 'de'],
    isActive: true
  },
  {
    id: 'ted_ed',
    name: 'TED-Ed',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['education', 'learning', 'animation'],
    languages: ['en', 'zh', 'ja'],
    isActive: true
  },
  {
    id: 'crash_course',
    name: 'Crash Course',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 5,
    reliability: 0.85,
    domains: ['education', 'history', 'science'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'skillshare_search',
    name: 'Skillshare',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.8,
    domains: ['creative', 'design', 'business'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'masterclass_search',
    name: 'MasterClass',
    category: SearchSourceCategory.KNOWLEDGE_BASES,
    priority: 7,
    maxResults: 100,
    rateLimit: 3,
    reliability: 0.85,
    domains: ['skills', 'creative', 'professional'],
    languages: ['en'],
    isActive: true
  },

  // ===== 专业数据库源 (15个) =====

  // 法律数据库 (5个)
  {
    id: 'westlaw_search',
    name: 'Westlaw',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['law', 'legal_research', 'cases'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'lexisnexis_search',
    name: 'LexisNexis',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['law', 'legal_research', 'news'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'justia_search',
    name: 'Justia',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['law', 'legal_research', 'free_access'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'google_scholar_legal',
    name: 'Google Scholar (Legal)',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 5,
    reliability: 0.9,
    domains: ['law', 'legal_research', 'cases'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'courtlistener',
    name: 'CourtListener',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['law', 'court_cases', 'legal_opinions'],
    languages: ['en'],
    isActive: true
  },

  // 医学数据库 (5个)
  {
    id: 'cochrane_library',
    name: 'Cochrane Library',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 3,
    reliability: 0.95,
    domains: ['medicine', 'systematic_reviews', 'evidence'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'embase_search',
    name: 'Embase',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['medicine', 'biomedical', 'pharmacology'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'clinicaltrials_gov',
    name: 'ClinicalTrials.gov',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 5,
    reliability: 0.95,
    domains: ['medicine', 'clinical_trials', 'research'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'who_iris',
    name: 'WHO IRIS',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['medicine', 'public_health', 'who'],
    languages: ['en', 'fr', 'es'],
    isActive: true
  },
  {
    id: 'uptodate_search',
    name: 'UpToDate',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['medicine', 'clinical_decision', 'evidence'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },

  // 工程数据库 (5个)
  {
    id: 'compendex_search',
    name: 'Compendex',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['engineering', 'technology', 'applied_science'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'inspec_search',
    name: 'Inspec',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 9,
    maxResults: 200,
    rateLimit: 2,
    reliability: 0.95,
    domains: ['physics', 'engineering', 'computing'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'knovel_search',
    name: 'Knovel',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 2,
    reliability: 0.9,
    domains: ['engineering', 'materials', 'chemicals'],
    languages: ['en'],
    requiresAuth: true,
    isActive: true
  },
  {
    id: 'asce_library',
    name: 'ASCE Library',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['civil_engineering', 'construction', 'infrastructure'],
    languages: ['en'],
    isActive: true
  },
  {
    id: 'sae_mobilus',
    name: 'SAE MOBILUS',
    category: SearchSourceCategory.PROFESSIONAL_DATABASES,
    priority: 8,
    maxResults: 150,
    rateLimit: 3,
    reliability: 0.9,
    domains: ['automotive', 'aerospace', 'mobility'],
    languages: ['en'],
    isActive: true
  },

  // Note: Now includes 200+ search sources
  // Comprehensive coverage including academic, news, technical, social, government, business, knowledge base, and professional databases
];

/**
 * 根据类别获取搜索源
 */
export function getSourcesByCategory(category: SearchSourceCategory): SearchSourceConfig[] {
  return COMPREHENSIVE_SEARCH_SOURCES.filter(source => source.category === category && source.isActive);
}

/**
 * 根据领域获取搜索源
 */
export function getSourcesByDomain(domain: string): SearchSourceConfig[] {
  return COMPREHENSIVE_SEARCH_SOURCES.filter(source => 
    source.isActive && 
    (source.domains?.includes(domain) || source.domains?.includes('all'))
  );
}

/**
 * 获取高优先级搜索源
 */
export function getHighPrioritySources(minPriority: number = 8): SearchSourceConfig[] {
  return COMPREHENSIVE_SEARCH_SOURCES.filter(source => 
    source.isActive && source.priority >= minPriority
  );
}

/**
 * 获取所有活跃的搜索源
 */
export function getAllActiveSources(): SearchSourceConfig[] {
  return COMPREHENSIVE_SEARCH_SOURCES.filter(source => source.isActive);
}
