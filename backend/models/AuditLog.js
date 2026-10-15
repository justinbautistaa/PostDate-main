const mongoose = require("mongoose");

/**
 * AuditLog
 * One row per action a staff member takes from the dashboard. Feeds the
 * admin-only "Mod activity" section and is the paper trail for the
 * "sensitive actions are traceable" part of the security checklist.
 *
 * Append-only by design: nothing in the API updates or deletes these.
 */
const AUDIT_ACTIONS = [
  "user.suspend",
  "user.reinstate",
  "user.role_change",
  "report.update",
  "rating.hide",
  "rating.restore",
  "appeal.approve",
  "appeal.deny"
];

const auditLogSchema = new mongoose.Schema(
  {
    // Who did it, and what role they held at the time (a later demotion
    // shouldn't rewrite history)
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    actorRole: {
      type: String,
      enum: ["user", "moderator", "admin"],
      required: true
    },

    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true
    },

    targetType: {
      type: String,
      enum: ["user", "report", "rating", "appeal"],
      required: true
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    // A sentence a human can read in the activity feed
    summary: {
      type: String,
      trim: true,
      maxlength: 400,
      default: ""
    },

    // Small structured extras (old/new status, the reason given, ...)
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined
    }
  },
  {
    // No updatedAt — a log entry never changes
    timestamps: { createdAt: true, updatedAt: false }
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
AuditLog.AUDIT_ACTIONS = AUDIT_ACTIONS;

module.exports = AuditLog;
