# Refine the booking sheet and rider trip flow

**Features**
- [x] Keep the checkout UI compact so it shows only the price, destination, and fare adjustment controls.
- [x] Limit fare adjustment to 10% down, neutral, or 10% up and remove the extra 20% / 25% style options.
- [x] Keep the map visible in the background while the rider reviews the trip instead of covering the full screen with checkout content.
- [x] Add a draggable bottom sheet so the rider can slide the trip details up or leave them mid / lower on the screen.
- [x] Start the rider flow with driver search after booking, then move into accepted, arriving, arrived, and in-trip states.
- [x] Show live direction context after booking so the rider can follow the driver approaching pickup and then the destination route after trip start.
- [x] Hide rider-to-driver calling on checkout until a ride has actually been booked.
- [x] Persist the active ride session so reopening the app keeps the trip alive until the rider explicitly cancels it.
- [x] Capture structured cancellation reasons when the rider cancels an active trip.

**Design**
- [x] Use a smaller floating booking sheet with a cleaner hierarchy and less clutter.
- [x] Keep the direction map as the visual focus and move secondary details into the draggable sheet.
- [x] Make the price adjustment controls feel simple and deliberate instead of overloaded.
- [x] Use clearer stage messaging so the rider understands when the driver is assigned, arriving, at pickup, or on trip.
- [x] Let the rider expand the sheet either by tapping the handle or dragging the sheet directly.

**Pages / Screens**
- [x] Redesign the booking confirmation screen into a compact map-first checkout sheet.
- [x] Replace the oversized checkout content with a draggable bottom sheet that exposes only essential trip details.
- [x] Rework the ride progress screen to show driver search, accepted, pickup approach, arrival, and trip progress stages.
- [x] Support route rendering from custom start/end points so the ride progress screen can show driver-to-pickup and trip-to-destination paths.
- [x] Update the rider live-trip screen so pre-pickup focuses on the vehicle map and on-trip focuses on live direction.
- [x] Update the driver active-trip screen so the driver can follow the rider pickup position in real time and then switch to the destination route.

**What I’ll fix behind the scenes**
- [x] Preserve stable route loading while allowing route rendering for dynamic rider-trip stages.
- [x] Support custom markers on the shared map component so driver position can be displayed during pickup and trip progress.
- [x] Keep the new map and sheet flow compatible with React Native Web and Expo.
- [x] Verify the updated implementation passes TypeScript type checking.

**What you may still need to provide**
- [ ] A working maps key with the required route and place services enabled.
- [ ] Billing enabled on your maps project if you want live turn-by-turn route results instead of the estimated fallback.
- [ ] A phone number or support contact target for the Call button if you want it to place a real call.
- [ ] A screenshot reference if you want me to match a specific ride-sheet layout or animation style even more closely.
