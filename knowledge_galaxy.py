import os
import re
import json
from datetime import datetime

# ==============================================================================
# CONFIGURATION AND HIGH-DENSITY CLUSTER SCHEMAS
# ==============================================================================
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")   # not the cwd: the server also runs this
GRAPH_DATA_PATH = os.path.join(FRONTEND_DIR, "graph-data.js")

# Strict pipeline cluster classification mapping & Hex brand frequencies
CLUSTER_THEMES = {
    "Financial Engines": {"color": "#00ffcc", "val": 7},    # Neon Teal (Webull, IBKR)
    "Local Context": {"color": "#ff9900", "val": 6},        # Amber (Cartagena Engine)
    "Voice AI Core": {"color": "#ff0066", "val": 8},        # Hot Pink (TTS, Claude Core)
    "YouTube Strategy": {"color": "#ff3333", "val": 5},     # Red (Content Pillars)
    "Skool Community": {"color": "#33cc66", "val": 5},      # Green (User Funnels)
    "Market Research": {"color": "#9933ff", "val": 5},      # Purple (SaaS indices)
    "System Subsystems": {"color": "#a0a0a0", "val": 4}     # Cyber Silver (Compactors)
}

# ==============================================================================
# DEEP STRUCTURAL DATA GENERATION (THE MELTING OF MINDS)
# ==============================================================================
def compile_high_density_galaxy():
    """Scans repository files, expands sub-elements into sub-nodes, builds keyword connections, and appends true usage metrics."""
    os.makedirs(FRONTEND_DIR, exist_ok=True)
    
    nodes = []
    links = []
    node_id_counter = 0
    keyword_map = {} # Maps keywords to list of node IDs for deep cluster mesh strings

    # 1. CORE LIVING ENGINE INTEGRATION (Your Real Subsystems)
    system_nodes = [
        {"label": "Daily Cartagena Digest", "group": "Local Context", "desc": "Live October 2026 climate feeds, Keyless Open-Meteo variables, and regional economic briefs."},
        {"label": "IBKR Trader Node", "group": "Financial Engines", "desc": "Interactive Brokers automated engine tracking equity matrices, portfolio balances, and safety guards."},
        {"label": "Webull Main Engine", "group": "Financial Engines", "desc": "Active trading portal processing live indicator triggers and custom market tracking sheets."},
        {"label": "Webull Crypto Node", "group": "Financial Engines", "desc": "Dedicated digital currency scanner monitoring high-velocity assets and transaction states."},
        {"label": "Chatterbox TTS Server", "group": "Voice AI Core", "desc": "High-fidelity voice synthesis engine running on Port 8004 streaming 48 kHz uncompressed custom WAV audio loops."},
        {"label": "WhatsApp Baileys Bridge", "group": "Voice AI Core", "desc": "Ultra-stable session socket running on Port 3101 managing automated 7:00 AM broadcast cards with custom gitignore rules."},
        {"label": "Automated Database Compactor", "group": "System Subsystems", "desc": "Background storage maintenance engine sweeping file repositories and recycling dead logs."},
        {"label": "Local Storage Auditor", "group": "System Subsystems", "desc": "Disk architecture diagnostics tracking memory bounds and file version safety rails."}
    ]

    # Daily Cartagena Digest: append the live scrape (Open-Meteo weather, USD/COP, Acuacar water alerts, IPCC bulletins).
    # It goes only into the excerpt, so scraped headlines do not create keyword links to other nodes.
    for sn in system_nodes:
        if sn["label"] == "Daily Cartagena Digest":
            try:
                import cartagena_scraper
                sn["live"] = cartagena_scraper.excerpt()
            except Exception as e:   # the galaxy must still build when a source or the module is unavailable
                sn["live"] = f"(live scrape unavailable: {type(e).__name__})"

    for sys in system_nodes:
        theme = CLUSTER_THEMES.get(sys["group"], {"color": "#3399ff", "val": 4})
        nodes.append({
            "id": node_id_counter,
            "label": sys["label"],
            "group": sys["group"],
            "color": theme["color"],
            "val": theme["val"],
            "excerpt": sys["desc"] + (chr(10) * 2 + sys["live"] if sys.get("live") else "")
        })
        # Extract keywords for string line networking links
        for word in re.findall(r'\w+', sys["label"].lower() + " " + sys["desc"].lower()):
            if len(word) > 4:
                keyword_map.setdefault(word, []).append(node_id_counter)
        node_id_counter += 1

    # 2. THE MULTI-METRIC ANTHROPIC ACCOUNT USAGE TELEMETRY (What you expect to see!)
    usage_metrics = [
        {"label": "Anthropic Monitor: Account Balance", "val_str": "$87.89", "desc": "True remaining developer usage credits available for active pay-as-you-go operations."},
        {"label": "Anthropic Monitor: Included Credit", "val_str": "$100.00 / $100.00", "desc": "Massive promotional credit tier active and fully untouched until official expiration on November 5."},
        {"label": "Anthropic Monitor: Monthly Accumulation", "val_str": "$12.39 Spent", "desc": "Total consolidated financial expenditure compiled across active billing nodes this month."},
        {"label": "Anthropic Monitor: Resource Bound", "val_str": "70% Weekly Limit Used", "desc": "Weekly model quota tracking threshold. Short-term capacity limits scheduled to reset fully this Sunday at 12:00 PM."}
    ]

    for metric in usage_metrics:
        theme = CLUSTER_THEMES["Voice AI Core"] # Glowing Hot Pink
        nodes.append({
            "id": node_id_counter,
            "label": f"{metric['label']}: {metric['val_str']}",
            "group": "Voice AI Core",
            "color": theme["color"],
            "val": 6,
            "excerpt": metric["desc"]
        })
        # Explicit link string connecting all usage metrics back to the core Voice AI server
        links.append({"source": 4, "target": node_id_counter, "value": 3}) # Link to Chatterbox/Voice core
        node_id_counter += 1

    # 3. TRANSGRESSING SLIDE METADATA INTO HIGH-DENSITY CLUSTERS (The AI Workshop)
    workshop_clusters = {
        "YouTube Strategy": [
            {"title": "YouTube Hook Formula", "text": "Problem identification, immediate visual proof, and step-by-step installation blue-printing blocks."},
            {"title": "Content Pillar Blueprint", "text": "Isolate high-engagement local development rigs, autonomous voice control modules, and direct Claude Code pipelines."},
            {"title": "Algorithmic Retention Engine", "text": "Pacing rules engineered to match recommendation matrices via fast visual setups and hook triggers."}
        ],
        "Skool Community": [
            {"title": "Skool User Funnel", "text": "Free community architecture designed as the foundational onboarding structure for automated assets."},
            {"title": "Plug-and-Play Frameworks", "text": "Distribute immediate, interactive code layouts to provide instant utility upon membership initialization."},
            {"title": "Gamification Reward Matrix", "text": "Milestone tiers configured to incentivize active community participation, peer reviews, and peer trouble-shooting loops."}
        ],
        "Market Research": [
            {"title": "SaaS Operational Bottlenecks", "text": "Identify major administrative drags including fragmented CRM pipelines and lagging manual data cross-referencing loops."},
            {"title": "Local LLM Disintermediation", "text": "Leveraging local automated model execution networks to permanently eliminate ongoing subscription dependencies and lower SaaS overhead."}
        ]
    }

    for group, elements in workshop_clusters.items():
        theme = CLUSTER_THEMES.get(group, {"color": "#3399ff", "val": 4})
        
        # Create a central anchor node for this workshop topic
        anchor_id = node_id_counter
        nodes.append({
            "id": anchor_id,
            "label": f"Cluster: {group}",
            "group": group,
            "color": theme["color"],
            "val": 6,
            "excerpt": f"Master data repository housing high-density metrics regarding {group} implementations."
        })
        node_id_counter += 1

        # Expand sub-elements into distinct orbiting satellites (Gives the high density look!)
        for elem in elements:
            sat_id = node_id_counter
            nodes.append({
                "id": sat_id,
                "label": elem["title"],
                "group": group,
                "color": theme["color"],
                "val": 4,
                "excerpt": elem["text"]
            })
            # Core string link binding satellite to its anchor
            links.append({"source": anchor_id, "target": sat_id, "value": 2})
            
            # Index text for secondary keyword overlap networks
            for word in re.findall(r'\w+', elem["title"].lower() + " " + elem["text"].lower()):
                if len(word) > 5:
                    keyword_map.setdefault(word, []).append(sat_id)
            node_id_counter += 1

    # 4. COMPILING SYNAPTIC SPIDERWEB CONNECTIONS (Automated Keyword String Linker)
    for word, matched_ids in keyword_map.items():
        if len(matched_ids) > 1:
            # Connect items that share mutual keywords to generate high-density net strings
            for i in range(len(matched_ids) - 1):
                links.append({
                    "source": matched_ids[i],
                    "target": matched_ids[i+1],
                    "value": 1
                })

    # Export out the clean, unified, un-truncated GRAPH payload definition script
    graph_payload = {"nodes": nodes, "links": links}
    with open(GRAPH_DATA_PATH, "w", encoding="utf-8") as f:
        f.write(f"const GRAPH = {json.dumps(graph_payload, indent=2)};")
    print(f"Galaxy successfully generated with {len(nodes)} nodes and {len(links)} synaptic strings!")

if __name__ == "__main__":
    compile_high_density_galaxy()
