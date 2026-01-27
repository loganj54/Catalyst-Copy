#!/usr/bin/env python3
"""
Find relevant educational videos for a learning unit.

Uses Supabase Edge Function for intelligent video discovery with:
- Context-aware search based on learning unit metadata
- Fast path: Search pre-loaded videos in Pinecone
- Slow path: On-demand loading from YouTube with two-pass analysis
- Relevance scoring and match explanations

Part of the WAT (Workflows, Agents, Tools) framework.
See workflows/find-videos.md for complete documentation.

Usage:
    python find_videos.py <blueprint_id> <unit_id>
    python find_videos.py <blueprint_id> <unit_id> --max-results 10
    python find_videos.py <blueprint_id> <unit_id> --verbose

Environment Variables:
    SUPABASE_URL - Supabase project URL
    SUPABASE_ANON_KEY - Supabase anonymous key
"""

import os
import sys
import json
import requests
from typing import List, Dict, Optional

# Load environment variables from .env if available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("ERROR: Missing required environment variables:")
    print("  - SUPABASE_URL")
    print("  - SUPABASE_ANON_KEY")
    print("\nSet these in your .env file or environment.")
    sys.exit(1)


def find_videos(
    blueprint_id: str,
    unit_id: str,
    preferred_types: Optional[List[str]] = None,
    max_results: int = 5,
    verbose: bool = False
) -> Dict:
    """
    Find educational videos for a learning unit.

    Args:
        blueprint_id: The student's learning plan identifier
        unit_id: The specific learning unit identifier
        preferred_types: Optional list of preferred video types
        max_results: Maximum number of videos to return (default: 5)
        verbose: Print detailed progress information

    Returns:
        Response dictionary with videos and search metadata

    Raises:
        requests.HTTPError: If the API request fails
    """
    if verbose:
        print(f"Searching for videos...")
        print(f"  Blueprint ID: {blueprint_id}")
        print(f"  Unit ID: {unit_id}")
        print(f"  Max results: {max_results}")

    endpoint = f"{SUPABASE_URL}/functions/v1/find-videos"

    payload = {
        "blueprint_id": blueprint_id,
        "unit_id": unit_id,
        "max_results": max_results
    }

    if preferred_types:
        payload["preferred_video_types"] = preferred_types

    if verbose:
        print(f"\nCalling API: POST {endpoint}")

    response = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=120  # 2 minutes for slow path
    )

    if verbose:
        print(f"Response status: {response.status_code}")

    response.raise_for_status()

    return response.json()


def format_video_output(video: Dict, index: int) -> str:
    """Format a single video for console output."""
    lines = [
        f"\n{index}. {video['title']}",
        f"   URL: {video['url']}",
        f"   Channel: {video['channel_name']}",
        f"   Duration: {video['duration'] // 60}:{video['duration'] % 60:02d}",
        f"   Categories: {', '.join(video['categories'])}",
    ]

    if video.get('difficulty_level'):
        lines.append(f"   Difficulty: {video['difficulty_level']}")

    lines.append(f"   Relevance: {video['relevance_score']:.2f}")

    if video.get('average_rating'):
        lines.append(f"   Rating: {video['average_rating']:.1f}/5.0")

    lines.append(f"   Match: {video['match_explanation']}")

    return "\n".join(lines)


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    blueprint_id = sys.argv[1]
    unit_id = sys.argv[2]

    # Parse optional arguments
    max_results = 5
    verbose = False

    for i, arg in enumerate(sys.argv[3:], start=3):
        if arg == "--max-results" and i + 1 < len(sys.argv):
            max_results = int(sys.argv[i + 1])
        elif arg == "--verbose" or arg == "-v":
            verbose = True

    try:
        result = find_videos(
            blueprint_id,
            unit_id,
            max_results=max_results,
            verbose=verbose
        )

        if not result.get('success'):
            print(f"\nERROR: {result.get('error', 'Unknown error')}")
            sys.exit(1)

        videos = result.get('videos', [])
        search_info = result.get('search_strategy_used', {})

        print("\n" + "=" * 80)
        print(f"FOUND {len(videos)} VIDEOS")
        print("=" * 80)

        if search_info:
            print(f"\nSearch Strategy:")
            print(f"  Detected Need: {search_info.get('detected_need', 'N/A')}")
            print(f"  Queries Executed: {search_info.get('queries_executed', 0)}")
            print(f"  Total Candidates: {search_info.get('total_candidates', 0)}")

        if videos:
            for i, video in enumerate(videos, 1):
                print(format_video_output(video, i))
        else:
            print("\nNo videos found that match your specific learning need.")
            print("Try:")
            print("  - Searching YouTube directly")
            print("  - Asking your instructor for help")
            print("  - Reviewing course materials")

        print("\n" + "=" * 80)

    except requests.HTTPError as e:
        print(f"\nAPI ERROR: {e}")
        if verbose and e.response is not None:
            print(f"Response: {e.response.text}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nSearch cancelled by user.")
        sys.exit(130)
    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {e}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
