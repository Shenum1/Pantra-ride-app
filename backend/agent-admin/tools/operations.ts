import { z } from "zod";
import { defineReadTool } from "../types";
import { getOperationsOverview } from "../../services/admin/overview";
import { listTrips, listTripsInput } from "../../services/admin/trips";

export const getOperationsOverviewTool = defineReadTool({
  name: "get_operations_overview",
  description:
    "Get a snapshot of Pantra's current operational state: user/driver/rider counts, drivers online now, trips today and in progress, revenue and platform commission (today and all-time, in NGN), tips, the 5 most recent activity events, and 'needsAttention' counts (drivers in manual review, documents awaiting review, failed payouts, failed wallet transactions, open support tickets). Start here to decide what needs action. Read-only.",
  inputSchema: z.object({}),
  run: (db) => getOperationsOverview(db),
});

export const listTripsTool = defineReadTool({
  name: "list_trips",
  description:
    "List trips (rides), newest first, with rider and driver names, pickup/dropoff addresses, status, the full fare breakdown in NGN (base, booking, service, zone, waiting, priority and cancellation fees), lifecycle timestamps (requested/accepted/arrived/started/completed/cancelled), cancellation reason, payment method and status, and the platform commission/driver earnings split. Returns {rides, total}. Read-only.",
  inputSchema: listTripsInput,
  run: (db, input) => listTrips(db, input),
});
