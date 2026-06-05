import {
  pgSchema,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const distributorSchema = pgSchema("distributor");

export const distributorStatus = distributorSchema.enum("DistributorStatus", [
  "NEW",
  "CALLED",
  "CALLBACK",
  "NOT_INTERESTED",
]);

export const contactStatus = distributorSchema.enum("ContactStatus", [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "QUALIFIED",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATING",
  "CLOSED_WON",
  "CLOSED_LOST",
  "NOT_INTERESTED",
]);

export const priorityLevel = distributorSchema.enum("PriorityLevel", [
  "LOW",
  "HIGH",
  "MEDIUM",
  "UNKNOWN",
]);

export const distributorGroups = distributorSchema.table("DistributorGroup", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  website: text("website"),
  states: text("states").array(),
  isPriority: boolean("isPriority").default(false).notNull(),
  priority: priorityLevel("priority").default("UNKNOWN").notNull(),
  addressLine1: text("addressLine1"),
  addressLine2: text("addressLine2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  addressFull: text("addressFull"),
  actions: text("actions").array().notNull().default([]),
  status: distributorStatus("status").default("NEW").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow().notNull(),
  lastUpdated: timestamp("lastUpdated", { withTimezone: false }).defaultNow().notNull(),
  lastUpdatedBy: text("lastUpdatedBy"),
});

export const branches = distributorSchema.table("Branch", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  website: text("website"),
  addressLine1: text("addressLine1"),
  addressLine2: text("addressLine2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  addressFull: text("addressFull"),
  groupId: text("groupId").notNull().references(() => distributorGroups.id, { onDelete: "cascade" }),
});

export const contacts = distributorSchema.table("Contact", {
  id: text("id").primaryKey(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  title: text("title"),
  email: text("email"),
  seniority: text("seniority"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  note: text("note"),
  status: contactStatus("status").default("NEW").notNull(),
  lastUpdated: timestamp("lastUpdated", { withTimezone: false }).defaultNow().notNull(),
  lastUpdatedBy: text("lastUpdatedBy"),
  groupId: text("groupId").notNull().references(() => distributorGroups.id, { onDelete: "cascade" }),
});

export const distributorNotes = distributorSchema.table("DistributorNote", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  user: text("user").notNull(),
  date: timestamp("date", { withTimezone: false }).defaultNow().notNull(),
  distributorId: text("distributorId").notNull().references(() => distributorGroups.id, { onDelete: "cascade" }),
});

export const distributorRelations = relations(distributorGroups, ({ many }) => ({
  branches: many(branches),
  contacts: many(contacts),
  notes: many(distributorNotes),
}));

export const branchRelations = relations(branches, ({ one }) => ({
  group: one(distributorGroups, { fields: [branches.groupId], references: [distributorGroups.id] }),
}));

export const contactRelations = relations(contacts, ({ one }) => ({
  group: one(distributorGroups, { fields: [contacts.groupId], references: [distributorGroups.id] }),
}));

export const distributorNoteRelations = relations(distributorNotes, ({ one }) => ({
  distributor: one(distributorGroups, { fields: [distributorNotes.distributorId], references: [distributorGroups.id] }),
}));

export type DistributorGroup = typeof distributorGroups.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type DistributorNote = typeof distributorNotes.$inferSelect;
