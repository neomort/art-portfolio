# Properties Page URL Parameters

This document describes the supported query parameters for deep-linking and sharing filtered/maps views of the Properties page (`/properties`).

All parameters are optional and can be combined. Parameters that map to UI state are synchronized both ways:
- If present in the URL, the page initializes with them.
- When the user changes the associated UI controls, the URL is updated.

## Core Parameters

- `view` (string): Controls the page layout panel.
  - Values: `map`, `filters`, `full`
  - Behavior:
    - `map` → Map panel shown (desktop); on mobile this toggles the map view.
    - `filters` → Filters panel shown (desktop); on mobile this toggles the filters view.
    - `full` → Full-width results (no side panel).

- `org_id` (UUID string): Filter results to a specific organization.
  - Example: `org_id=98ee1c3e-27d2-46dc-9d9d-8853a74dbd46`
  - Notes: When present, the page title and header use the organization name.

## Map Parameters

- `lat` (number): Map center latitude.
- `lng` (number): Map center longitude.
- `z` (integer): Map zoom level.
  - Examples:
    - `lat=40.7608&lng=-111.8910&z=12`

## Filter Parameters

- `radius` or `r` (integer): Search radius in miles.
  - Range: `0`–`500` (values outside are clamped)
  - Examples: `radius=10` or `r=10`

- `type` (CSV string): One or more property types.
  - Example: `type=retail,office`

- `amenities` (CSV string): One or more amenity slugs to filter by.
  - Example: `amenities=ac,parking,kitchen`

## Other Supported Parameters

- `location` (string): Free-form text used in the location field. (Best-effort use; may be ignored if `lat/lng` are present.)

## Examples

- Show map and focus on an area:
  - `/properties?lat=40.7608&lng=-111.8910&z=12&view=map`

- Retail with A/C and Parking in a 10-mile radius, open filters panel:
  - `/properties?type=retail&amenities=ac,parking&radius=10&view=filters`

- Organization listings with map panel open:
  - `/properties?org_id=98ee1c3e-27d2-46dc-9d9d-8853a74dbd46&view=map`

- Full-width results (no side panel):
  - `/properties?view=full`

## Notes & Considerations

- If both `lat/lng/z` and `location` are provided, `lat/lng/z` take precedence for map centering.
- When the user changes filters or the view/region in the UI, the URL is kept in sync so the page can be shared/bookmarked with the current state.
- Date filter deep-links are intentionally not implemented at this time.
