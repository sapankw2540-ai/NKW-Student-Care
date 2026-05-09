
/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "viewer"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===== Attendance System Tables =====

// ตารางห้องเรียน
export const classrooms = mysqlTable("classrooms", {
  id: varchar("id", { length: 20 }).primaryKey(), // e.g. m1-1
  name: varchar("name", { length: 50 }).notNull(), // e.g. ม.1
  status: int("status").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ตารางนักเรียน
export const students = mysqlTable("students", {
  id: int("id").autoincrement().primaryKey(),
  studentId: varchar("studentId", { length: 20 }).notNull().unique(),
  classroomId: varchar("classroomId", { length: 20 }).notNull(),
  no: int("no").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  status: int("status").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ตารางครู
export const teachers = mysqlTable("teachers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 100 }).notNull(),
  status: int("status").default(1).notNull(),
  role: mysqlEnum("role", ["teacher", "admin", "viewer"]).default("teacher").notNull(),
  classroomIds: text("classroomIds"), // comma-separated classroom IDs
  notifyTime: varchar("notifyTime", { length: 5 }).default("07:30"), // HH:MM for push notification
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ตารางช่วงเวลา
export const periods = mysqlTable("periods", {
  id: varchar("id", { length: 20 }).primaryKey(), // morning, noon, evening
  name: varchar("name", { length: 50 }).notNull(),
  status: int("status").default(1).notNull(),
});

// ตารางสถานะการเข้าเรียน
export const statusList = mysqlTable("status_list", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 50 }).notNull().unique(),
  color: varchar("color", { length: 50 }).notNull(),
  hexColor: varchar("hexColor", { length: 20 }).notNull(),
  status: int("status").default(1).notNull(),
});

// ตารางการเช็คชื่อ
export const attendance = mysqlTable("attendance", {
  // id: int("id").autoincrement().primaryKey(),
});