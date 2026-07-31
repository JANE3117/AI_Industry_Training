from tools.afr import query_afr
from tools.asx import query_asx
from tools.rba import query_rba

QUERY_DATA_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "query_data",
        "description": (
            "Query the approved local datasets for exact structured facts. "
            "Use this for every RBA/ASX numeric fact and every AFR pattern count "
            "-- never estimate a number that this tool can compute exactly."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "dataset": {"type": "string", "enum": ["rba", "asx", "afr"]},
                "metric": {
                    "type": "string",
                    "description": (
                        "rba: count, count_changes, count_increases, count_decreases, "
                        "extremes, max_hold_streak, lookup_rate, cycle_summary, list. "
                        "asx: dimensions, full_sample_return, annual_return, "
                        "rank_annual_returns, avg_volume, rank_avg_volume, volatility, "
                        "max_drawdown, correlation. "
                        "afr: count, count_by_month, share (all require pattern=); "
                        "semantic_retrieve (requires query=, for sentiment/context "
                        "questions where the relevant articles may not contain the "
                        "literal query words -- use pattern= metrics instead whenever "
                        "an exact count/share is what's actually being asked)."
                    ),
                },
                "ticker": {"type": "string", "description": "ASX ticker, e.g. BHP.AX"},
                "tickers": {"type": "array", "items": {"type": "string"}, "description": "exactly two tickers, for correlation"},
                "exclude_tickers": {"type": "array", "items": {"type": "string"}, "description": 'e.g. ["TAH.AX"] when a question says "excluding Tabcorp"'},
                "year": {"type": "integer"},
                "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                "pattern": {"type": "string", "description": 'Python regex, required for afr count/count_by_month/share, e.g. "\\\\bNAB\\\\b"'},
                "query": {"type": "string", "description": "natural-language text, required for afr semantic_retrieve, e.g. \"market reaction to the May 2022 rate hike\""},
                "top_k": {"type": "integer", "description": "number of articles to return for semantic_retrieve, default 5"},
            },
            "required": ["dataset", "metric"],
        },
    },
}


def query_data(dataset, metric, **kwargs):
    if dataset == "rba":
        return query_rba(metric, **kwargs)
    if dataset == "asx":
        return query_asx(metric, **kwargs)
    if dataset == "afr":
        return query_afr(metric, **kwargs)
    return {"error": f"unknown dataset: {dataset}"}
