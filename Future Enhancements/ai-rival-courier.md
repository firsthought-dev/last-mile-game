# AI Rival Courier Mode

Not currently planned for build — noted for later consideration.

## Idea

Traffic today (`updateTraffic()` in [last-mile-game/game.js](../last-mile-game/game.js)) is dumb: each vehicle
just marches along a fixed `splineU` at a fixed lane offset, with no awareness of the player or other
traffic. A future mode could add a rival AI courier that competes with the player to reach deliveries first,
or reacts to the player's driving instead of sliding along rails.

## Source of the idea

A dev-blog writeup on building level-specific AI opponents (soccer, "hay" arena, racing) for a vehicle
combat game — [in8bitblog.wordpress.com writeup](http://in8bitblog.files.wordpress.com/2013/12/) (images
only, referenced by the user in chat, not fetched/verified as a live page). The soccer/hay-specific logic
isn't relevant to this game, but two patterns are directly reusable:

1. **Waypoint + "zone" recovery** — AI follows a list of waypoints; if knocked off-track (e.g. hits a pothole,
   gets shoved off-road), it validates whether it's still in its expected "zone" and either re-routes to a new
   waypoint or rejoins the track like a real driver would, instead of blindly driving into a wall trying to reach
   the next waypoint.
   - We already have the primitives for this: `splineProgress` / `curve.getPointAt()` on `VehicleController`
     give us position-along-road tracking for free.
2. **Object avoidance via raycasts** — cast rays forward from the AI vehicle, react to whatever they hit
   (other traffic, walls, jump edges) rather than pure waypoint-chasing. This is what stops AI vehicles from
   piling up on each other or driving through obstacles at the same waypoint.

## Why not now

No head-to-head AI opponent exists in the game yet — traffic is decorative/rail-bound. This is worth building
if/when a competitive delivery-race mode is planned, not before.
