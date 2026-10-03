const GRAPH = {
  "nodes": [
    {
      "id": "market-scraper",
      "label": "Market Scraper Pipeline",
      "type": "hub",
      "group": "System Subsystems",
      "color": "#a0a0a0",
      "excerpt": "System pipeline node (hub).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "webull-main",
      "label": "Webull Main",
      "type": "broker",
      "group": "Financial Engines",
      "color": "#00ffcc",
      "excerpt": "System pipeline node (broker).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "webull-crypto",
      "label": "Webull Crypto",
      "type": "broker",
      "group": "Financial Engines",
      "color": "#00ffcc",
      "excerpt": "System pipeline node (broker).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "ibkr-tracker",
      "label": "IBKR Tracker",
      "type": "broker",
      "group": "Financial Engines",
      "color": "#00ffcc",
      "excerpt": "System pipeline node (broker).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "philly-sports",
      "label": "Philly Sports Core",
      "type": "sports",
      "group": "System Subsystems",
      "color": "#a0a0a0",
      "excerpt": "System pipeline node (sports).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "storage-auditor",
      "label": "Local Storage Auditor",
      "type": "storage",
      "group": "System Subsystems",
      "color": "#a0a0a0",
      "excerpt": "System pipeline node (storage).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "db-compactor",
      "label": "Automated Database Compactor",
      "type": "compactor",
      "group": "System Subsystems",
      "color": "#a0a0a0",
      "excerpt": "System pipeline node (compactor).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "cartagena-digest",
      "label": "Daily Cartagena Digest",
      "type": "digest",
      "group": "Local Context",
      "color": "#ff9900",
      "excerpt": "System pipeline node (digest).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "ai-oracle",
      "label": "AI Self-Dialogue Oracle",
      "type": "oracle",
      "group": "Voice AI Core",
      "color": "#ff0066",
      "excerpt": "System pipeline node (oracle).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": "net-mapper",
      "label": "Network Device Mapper",
      "type": "netmap",
      "group": "System Subsystems",
      "color": "#a0a0a0",
      "excerpt": "System pipeline node (netmap).",
      "raw_text": "",
      "filename": ""
    },
    {
      "id": 0,
      "label": "Claude Code Pipelines",
      "group": "Workshop Notes",
      "color": "#3399ff",
      "excerpt": "Claude Code Pipelines\nMaximize file-system workflow efficiency by executing direct codebase modifications via terminal automation hooks. \nIsolate third-party libraries and leverage lightweight internal wrappers to lower latency bounds. \nImplement systematic validation steps including regex file sweeps, parallel network resource collection loops, and cache invalidation protocols.",
      "raw_text": "# Claude Code Pipelines\nMaximize file-system workflow efficiency by executing direct codebase modifications via terminal automation hooks. \nIsolate third-party libraries and leverage lightweight internal wrappers to lower latency bounds. \nImplement systematic validation steps including regex file sweeps, parallel network resource collection loops, and cache invalidation protocols.",
      "filename": "Claude_Code_Pipelines.md"
    },
    {
      "id": 1,
      "label": "Jarvis Core Skeleton",
      "group": "Workshop Notes",
      "color": "#3399ff",
      "excerpt": "Jarvis Core Skeleton\nThe foundational runtime skeleton depends on an Iron-Man reactor HUD style interface pulsing in synchronization with outbound text-to-speech audio streams. \nIntegrate cloned ElevenLabs voice synthesis with deep barge-in capabilities allowing real-time speech interruption. \nMaintain persistent context layers including live local environment scrapers and cross-platform notification pipelines.",
      "raw_text": "# Jarvis Core Skeleton\nThe foundational runtime skeleton depends on an Iron-Man reactor HUD style interface pulsing in synchronization with outbound text-to-speech audio streams. \nIntegrate cloned ElevenLabs voice synthesis with deep barge-in capabilities allowing real-time speech interruption. \nMaintain persistent context layers including live local environment scrapers and cross-platform notification pipelines.",
      "filename": "Jarvis_Core_Skeleton.md"
    },
    {
      "id": 2,
      "label": "Market Research Index",
      "group": "Market Research",
      "color": "#3399ff",
      "excerpt": "Market Research Index\nAnalyze high-velocity automation trends across modern small businesses. \nIdentify major technical operational bottlenecks including disjointed CRM tracking, delayed manual data cross-referencing, and complex API integration overhead. \nSolutions leveraging local automated LLM execution pipelines significantly lower ongoing SaaS subscriptions and subscription dependencies.",
      "raw_text": "# Market Research Index\nAnalyze high-velocity automation trends across modern small businesses. \nIdentify major technical operational bottlenecks including disjointed CRM tracking, delayed manual data cross-referencing, and complex API integration overhead. \nSolutions leveraging local automated LLM execution pipelines significantly lower ongoing SaaS subscriptions and subscription dependencies.",
      "filename": "Market_Research_Index.md"
    },
    {
      "id": 3,
      "label": "Skool Community Infrastructure",
      "group": "Skool Community",
      "color": "#3399ff",
      "excerpt": "Skool Community Infrastructure\nThe Free Skool Community serves as the foundational user funnel. \nProvide interactive plug-and-play code frameworks as immediate value props. \nOrganize discussion spaces into logical categories: Daily Standups, Hardware Integration, and Prompt Pack Customization. \nGamify milestone rewards to incentivize community contributions and active troubleshooting support among members.",
      "raw_text": "# Skool Community Infrastructure\nThe Free Skool Community serves as the foundational user funnel. \nProvide interactive plug-and-play code frameworks as immediate value props. \nOrganize discussion spaces into logical categories: Daily Standups, Hardware Integration, and Prompt Pack Customization. \nGamify milestone rewards to incentivize community contributions and active troubleshooting support among members.",
      "filename": "Skool_Community_Infrastructure.md"
    },
    {
      "id": 4,
      "label": "YouTube Channel Strategy",
      "group": "YouTube Channel",
      "color": "#3399ff",
      "excerpt": "YouTube Channel Strategy\nFocus on high-engagement hooks and systematic content pillars. \nCluster topics around AI automation, local development setups, and Jarvis integration. \nEvery video should feature a clear hook-formula: problem identification, immediate visual proof, and a step-by-step installation blueprint. \nTarget key terms such as Claude Code, Jarvis assistant development, and autonomous voice control. Maintain high visual pacing to match algorithmic recommendation systems.",
      "raw_text": "# YouTube Channel Strategy\nFocus on high-engagement hooks and systematic content pillars. \nCluster topics around AI automation, local development setups, and Jarvis integration. \nEvery video should feature a clear hook-formula: problem identification, immediate visual proof, and a step-by-step installation blueprint. \nTarget key terms such as Claude Code, Jarvis assistant development, and autonomous voice control. Maintain high visual pacing to match algorithmic recommendation systems.",
      "filename": "YouTube_Channel_Strategy.md"
    }
  ],
  "links": [
    {
      "source": "market-scraper",
      "target": "webull-main",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "webull-crypto",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "ibkr-tracker",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "philly-sports",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "storage-auditor",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "db-compactor",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "cartagena-digest",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "ai-oracle",
      "value": 2
    },
    {
      "source": "market-scraper",
      "target": "net-mapper",
      "value": 2
    }
  ]
};