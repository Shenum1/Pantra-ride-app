import { defineReadTool, defineWriteTool, pick } from "../types";
import {
  decideDriverVerification,
  decideDriverVerificationInput,
  getDriverVerificationDetail,
  getDriverVerificationDetailInput,
  listDriverDocuments,
  listDriverDocumentsInput,
  listDriversForVerification,
  listDriversForVerificationInput,
  reviewDriverDocument,
  reviewDriverDocumentInput,
} from "../../services/admin/driver-verification";

// Signed URLs to identity documents (licence, selfie, vehicle papers) are
// deliberately never handed to the agent — it gets document status and
// metadata only. A human reviews the actual images in admin-web.
const NO_DOCUMENT_URLS = { includeSignedUrls: false };

export const listDriversPendingVerificationTool = defineReadTool({
  name: "list_drivers_pending_verification",
  description:
    "List drivers in the verification pipeline (up to 100, most recently updated first) with name, email, operating state, vehicle category, verificationStatus, progress (0-100) and any rejection reason. Defaults to MANUAL_REVIEW — drivers who have finished their checklist and are waiting on an admin decision. Returns {drivers}. Read-only.",
  inputSchema: listDriversForVerificationInput,
  run: (db, input) => listDriversForVerification(db, input),
});

export const getDriverVerificationDetailTool = defineReadTool({
  name: "get_driver_verification_detail",
  description:
    "Get one driver's verification case: profile and vehicle details, the documents required for their state and vehicle category, every uploaded document with its review status and expiry date, automated check results, and the verification audit log. Document image URLs are intentionally NOT included. Read this before proposing a verification decision. Read-only.",
  inputSchema: getDriverVerificationDetailInput,
  run: (db, input) => getDriverVerificationDetail(db, input, NO_DOCUMENT_URLS),
});

export const listPendingDocumentsTool = defineReadTool({
  name: "list_pending_documents",
  description:
    "List uploaded driver documents (up to 100, newest first) with driver name, document type, review status, upload/review dates, expiry date and rejection reason. Defaults to pending — the documents awaiting review. Document image URLs are intentionally NOT included. Returns {documents}. Read-only.",
  inputSchema: listDriverDocumentsInput,
  run: (db, input) => listDriverDocuments(db, input, NO_DOCUMENT_URLS),
});

export const decideDriverVerificationTool = defineWriteTool({
  name: "decide_driver_verification",
  description:
    "Propose a final verification decision for a driver: VERIFIED (allowed to go online and take trips), REJECTED (blocked; driver is notified with the reason), or MANUAL_REVIEW (flagged for more review). Include a reason for REJECTED or MANUAL_REVIEW — the driver sees it. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves, and the admin will check the actual document images, so base the rationale on the case data you read.",
  inputSchema: decideDriverVerificationInput,
  summarize: (input) => `Set driver ${input.driverId} to ${input.decision}${input.reason ? ` — "${input.reason}"` : ""}`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("drivers").select("verificationStatus").eq("id", input.driverId).single();
    if (error || !data) throw new Error("Driver not found.");
    return pick(data, ["verificationStatus"]);
  },
  run: (db, input, actorAdminId) => decideDriverVerification(db, actorAdminId, input),
});

export const reviewDriverDocumentTool = defineWriteTool({
  name: "review_driver_document",
  description:
    "Propose approving or rejecting a single uploaded driver document. Rejecting requires the driver to re-upload it and is shown with the rejection reason. The driver's overall verification status is then recomputed automatically. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves after viewing the document image.",
  inputSchema: reviewDriverDocumentInput,
  summarize: (input) =>
    `${input.action === "approve" ? "Approve" : "Reject"} document ${input.documentId}${
      input.rejectionReason ? ` — "${input.rejectionReason}"` : ""
    }`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("driver_documents").select("status").eq("id", input.documentId).single();
    if (error || !data) throw new Error("Document not found.");
    return pick(data, ["status"]);
  },
  run: (db, input, actorAdminId) => reviewDriverDocument(db, actorAdminId, input),
});
