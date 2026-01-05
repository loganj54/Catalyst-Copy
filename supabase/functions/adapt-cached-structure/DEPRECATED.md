# DEPRECATED: adapt-cached-structure

## Status
**DEPRECATED as of 2026-01-05**

## Reason
This function was part of the full-structure caching system, which has been replaced by section-level caching for better granularity and reuse.

## Replacement
The new section-level caching system does not require adaptation of full structures. Instead:
- Individual sections are cached and retrieved
- Cache hits and misses are handled at the section level
- No adaptation step is needed - cached sections are used as-is

## Migration Path
If you need to use this function:
1. Consider migrating to the new section-level caching system
2. Use `check-structure-cache` to check for cached sections
3. Use `generate-structure-mixed` to generate only cache-missed sections
4. Use `orchestrate-generate-structure` which handles the entire workflow

## Related Functions
- **New**: `check-structure-cache` - Section-level cache lookup
- **New**: `generate-structure-mixed` - Partial generation for cache misses
- **New**: `cache-structure` - Section-level caching
- **Updated**: `orchestrate-generate-structure` - Section-level orchestration

## Last Updated
2026-01-05

