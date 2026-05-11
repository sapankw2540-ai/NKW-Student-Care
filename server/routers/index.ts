import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret_nkw_care");

export const appRouter = router({
  // Health check
  health: publicProcedure.query(() => "ok"),
  ping: publicProcedure.query(() => "pong"),
  version: publicProcedure.query(() => "4.5.10"),

  getAttendanceHistory: protectedProcedure
    .input(z.object({
      roomId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("attendance")
        .select("*")
        .eq("classroom_id", input.roomId)
        .gte("date", input.startDate)
        .lte("date", input.endDate)
        .order("date", { ascending: false });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // Group by date and period
      const grouped: Record<string, any> = {};
      data.forEach(item => {
        const key = `${item.date}_${item.period_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            date: item.date,
            period: item.period_id,
            students: []
          };
        }
        grouped[key].students.push({
          student_id: item.student_id,
          status: item.status_name,
          reason: item.notes,
        });
      });

      return Object.values(grouped);
    }),

  getAttendanceStats: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("attendance")
        .select("*, classrooms(name)")
        .gte("date", input.startDate)
        .lte("date", input.endDate);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return data;
    }),

  getFrequentAbsentees: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      threshold: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      // 1. Get all "Absent" records in the range
      const { data: attendance, error } = await ctx.supabase
        .from("attendance")
        .select("student_id, classroom_id")
        .eq("status_name", "ขาด")
        .gte("date", input.startDate)
        .lte("date", input.endDate);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // 2. Count occurrences per student
      const counts: Record<string, { count: number, classroomId: string }> = {};
      attendance.forEach(item => {
        if (!counts[item.student_id]) {
          counts[item.student_id] = { count: 0, classroomId: item.classroom_id };
        }
        counts[item.student_id].count++;
      });

      // 3. Filter by threshold
      const frequentStudentIds = Object.keys(counts).filter(id => counts[id].count >= input.threshold);

      if (frequentStudentIds.length === 0) return [];

      // 4. Get student details
      const { data: students, error: studentError } = await ctx.supabase
        .from("students")
        .select("student_id, name, classroom_id")
        .in("student_id", frequentStudentIds);

      if (studentError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: studentError.message });

      // 5. Combine and return
      return students.map(s => ({
        studentId: s.student_id,
        name: s.name,
        count: counts[s.student_id].count,
        classroomId: s.classroom_id,
      })).sort((a, b) => b.count - a.count);
    }),

  updatePushToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("teachers")
        .update({ push_token: input.token })
        .eq("id", ctx.user.id);
        
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  // Auth Routers
  teacherLogin: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const { data: teacher, error } = await ctx.supabase
        .from("teachers")
        .select("*")
        .eq("username", input.username)
        .single();

      if (error || !teacher || teacher.password !== input.password || teacher.status !== 1) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        });
      }

      const token = await new jose.SignJWT({
        id: teacher.id,
        name: teacher.name,
        role: teacher.role,
        username: teacher.username
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(JWT_SECRET);

      return {
        success: true,
        teacher: {
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          classroomIds: teacher.classroom_ids,
          role: teacher.role as "teacher" | "admin" | "viewer",
          notifyTime: teacher.notify_time,
        },
        token,
      };
    }),

  // Classroom Routers
  classrooms: publicProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("classrooms")
      .select("*")
      .eq("status", 1)
      .order("name");

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),

  // Student Routers
  studentsByClassroom: protectedProcedure
    .input(z.object({ classroomId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("students")
        .select("*")
        .eq("classroom_id", input.classroomId)
        .eq("status", 1)
        .order("no");

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // Map to frontend expected format
      return data.map(s => ({
        id: s.id,
        studentId: s.student_id,
        classroomId: s.classroom_id,
        no: s.no,
        name: s.name,
      }));
    }),

  // Attendance Routers
  getAttendance: protectedProcedure
    .input(z.object({ date: z.string(), period: z.string(), roomId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      let query = ctx.supabase
        .from("attendance")
        .select("*")
        .eq("date", input.date)
        .eq("period_id", input.period);

      if (input.roomId) {
        query = query.eq("classroom_id", input.roomId);
      }

      const { data, error } = await query;

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // If roomId is provided, return in the format { students: [...] } as expected by some UI
      if (input.roomId) {
        return {
          students: data.map(d => ({
            student_id: d.student_id,
            status: d.status_name,
            reason: d.notes,
          }))
        };
      }

      return data;
    }),

  getAttendanceByDatePeriod: protectedProcedure
    .input(z.object({ date: z.string(), period: z.string() }))
    .query(async ({ input, ctx }) => {
      const { data, error } = await ctx.supabase
        .from("attendance")
        .select("*")
        .eq("date", input.date)
        .eq("period_id", input.period);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // Group by roomId for the main dashboard list
      const grouped: Record<string, any[]> = {};
      data.forEach(item => {
        if (!grouped[item.classroom_id]) {
          grouped[item.classroom_id] = [];
        }
        grouped[item.classroom_id].push({
          student_id: item.student_id,
          status: item.status_name,
          reason: item.notes,
        });
      });

      return Object.entries(grouped).map(([roomId, students]) => ({
        roomId,
        students,
      }));
    }),

  saveAttendance: protectedProcedure
    .input(z.object({
      date: z.string(),
      period: z.string(),
      roomId: z.string(),
      teacher: z.string(),
      students: z.array(z.object({
        student_id: z.string(),
        status: z.string(),
        reason: z.string().optional().nullable(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role === "viewer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "คุณมีสิทธิ์ดูข้อมูลอย่างเดียว ไม่สามารถเช็คชื่อได้" });
      }

      // --- Prevent Duplicate Save ---
      const userRole = (ctx.user.role || "").trim().toLowerCase();
      const isAdmin = userRole === "admin";
      
      if (!isAdmin) {
        const { data: existing } = await ctx.supabase
          .from("attendance")
          .select("id")
          .eq("classroom_id", input.roomId)
          .eq("date", input.date)
          .eq("period_id", input.period)
          .limit(1);

        if (existing && existing.length > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "ห้องเรียนนี้ได้มีการบันทึกการเช็คชื่อในระบบเรียบร้อยแล้ว และไม่อนุญาตให้บันทึกซ้ำตามนโยบายของระบบ"
          });
        }
      }

      try {
        // Find teacher info
        const { data: teacher, error: teacherError } = await ctx.supabase
          .from("teachers")
          .select("id, name")
          .eq("username", input.teacher)
          .single();

        if (teacherError || !teacher) {
          console.error("Teacher lookup error:", teacherError);
          throw new TRPCError({ code: "NOT_FOUND", message: `Teacher '${input.teacher}' not found` });
        }

        const entries = input.students.map(s => ({
          student_id: s.student_id,
          classroom_id: input.roomId,
          period_id: input.period,
          date: input.date,
          status_name: s.status,
          notes: s.reason || "",
          teacher_id: teacher.id,
        }));

        const { error: upsertError } = await ctx.supabase
          .from("attendance")
          .upsert(entries, { onConflict: 'student_id,date,period_id' });

        if (upsertError) {
          console.error("Attendance upsert error:", upsertError);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: upsertError.message });
        }

        // --- LINE Messaging API ---
        try {
          const { data: config } = await ctx.supabase.from("school_config").select("line_channel_access_token, line_target_id, school_name").eq("id", 1).single();
          const { data: room } = await ctx.supabase.from("classrooms").select("name").eq("id", input.roomId).single();
          const { data: period } = await ctx.supabase.from("periods").select("name").eq("id", input.period).single();

          if (config?.line_channel_access_token && config?.line_target_id) {
            const counts = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0 };
            input.students.forEach(s => {
              if (s.status in counts) counts[s.status as keyof typeof counts]++;
            });

            const thaiDate = new Date(input.date).toLocaleDateString('th-TH', {
              year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });

            const message = `🔔 รายงานการเข้าร่วม [${period?.name || input.period}]\n🏫 ชั้น ${room?.name || input.roomId} ประจำ${thaiDate}\n----------------------\n✅ มา: ${counts.มา}\n❌ ขาด: ${counts.ขาด}\n⏰ สาย: ${counts.สาย}\n👤 ลา: ${counts.ลา}\n💊 ป่วย: ${counts.ป่วย}\n----------------------\n📝 ผู้บันทึก: ${teacher.name}`;

            await fetch("https://api.line.me/v2/bot/message/push", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.line_channel_access_token}`,
              },
              body: JSON.stringify({
                to: config.line_target_id,
                messages: [
                  {
                    type: "text",
                    text: message
                  }
                ]
              }),
            });
          }
          
          // --- Expo Push Notification ---
          const { data: admins } = await ctx.supabase
            .from("teachers")
            .select("push_token")
            .eq("role", "admin")
            .not("push_token", "is", null);

          if (admins && admins.length > 0) {
            const pushTokens = admins.map(a => a.push_token).filter(Boolean);
            if (pushTokens.length > 0) {
              const pushMessage = `มีการเช็คชื่อห้อง ${room?.name || input.roomId} แล้ว โดย ${teacher.name}`;
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Accept-encoding": "gzip, deflate",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(
                  pushTokens.map(token => ({
                    to: token,
                    sound: "default",
                    title: "NKW Student Care",
                    body: pushMessage,
                    data: { roomId: input.roomId, period: input.period },
                  }))
                ),
              });
            }
          }
        } catch (lineErr) {
          console.error("Messaging API / Push Notification failed:", lineErr);
        }

        return { success: true };
      } catch (err: any) {
        console.error("saveAttendance unexpected error:", err);
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  periods: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("periods")
      .select("*")
      .eq("status", 1);

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),

  // School Config
  getSchoolConfig: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("school_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return {
      schoolName: data.school_name,
      province: data.province,
      semester: data.semester,
      academicYear: data.academic_year,
      version: data.version,
      schoolLogoUrl: data.logo_url,
      lineChannelAccessToken: data.line_channel_access_token,
      lineTargetId: data.line_target_id,
    };
  }),

  updateSchoolConfig: adminProcedure
    .input(z.object({
      schoolName: z.string(),
      province: z.string(),
      semester: z.string(),
      academicYear: z.string(),
      version: z.string(),
      schoolLogoUrl: z.string().optional(),
      lineChannelAccessToken: z.string().optional(),
      lineTargetId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("school_config")
        .update({
          school_name: input.schoolName,
          province: input.province,
          semester: input.semester,
          academic_year: input.academicYear,
          version: input.version,
          logo_url: input.schoolLogoUrl,
          line_channel_access_token: input.lineChannelAccessToken,
          line_target_id: input.lineTargetId,
        })
        .eq("id", 1);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  uploadLogo: adminProcedure
    .input(z.object({ base64: z.string(), fileName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const { data, error } = await ctx.supabase.storage
        .from("logos")
        .upload(input.fileName, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const { data: publicUrlData } = ctx.supabase.storage
        .from("logos")
        .getPublicUrl(input.fileName);

      return { url: publicUrlData.publicUrl };
    }),

  // Admin & Dashboard Routers
  getAllTeachers: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("teachers")
      .select("*")
      .order("name");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data.map(t => ({
      id: t.id,
      name: t.name,
      username: t.username,
      role: t.role,
      classroomIds: t.classroom_ids,
      status: t.status,
      notifyTime: t.notify_time,
    }));
  }),

  allPeriods: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("periods")
      .select("*")
      .eq("status", 1);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),

  getAllStudents: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("students")
      .select("*")
      .eq("status", 1)
      .order("classroom_id")
      .order("no");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data.map(s => ({
      id: s.id,
      studentId: s.student_id,
      name: s.name,
      classroomId: s.classroom_id,
      no: s.no,
    }));
  }),

  getAttendanceByDateRange: adminProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      roomId: z.string().optional().nullable(),
    }))
    .query(async ({ input, ctx }) => {
      let query = ctx.supabase
        .from("attendance")
        .select(`
          id,
          date,
          period_id,
          classroom_id,
          student_id,
          status_name,
          notes,
          teachers (name),
          classrooms (name)
        `)
        .gte("date", input.startDate)
        .lte("date", input.endDate);

      if (input.roomId) {
        query = query.eq("classroom_id", input.roomId);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // Group by date, period, and classroom_id
      const grouped: Record<string, any> = {};
      data.forEach(item => {
        const key = `${item.date}_${item.period_id}_${item.classroom_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            id: item.id,
            date: item.date,
            period: item.period_id,
            roomId: item.classroom_id,
            teacher: (item as any).teachers?.name ?? "Unknown",
            students: []
          };
        }
        grouped[key].students.push({
          student_id: item.student_id,
          status: item.status_name,
          reason: item.notes,
          classroom_name: (item as any).classrooms?.name || "ไม่ทราบห้อง"
        });
      });

      return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    }),

  getDailyOverview: protectedProcedure
    .input(z.object({ date: z.string(), period: z.string() }))
    .query(async ({ input, ctx }) => {
      // 1. Get all classrooms
      const { data: classrooms, error: roomsError } = await ctx.supabase
        .from("classrooms")
        .select("*")
        .eq("status", 1)
        .order("name");

      if (roomsError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: roomsError.message });

      // 2. Get all students
      const { data: allStudents, error: studentsError } = await ctx.supabase
        .from("students")
        .select("*")
        .eq("status", 1);

      if (studentsError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: studentsError.message });

      // 3. Get attendance for the date/period
      const { data: attendance, error: attError } = await ctx.supabase
        .from("attendance")
        .select("*")
        .eq("date", input.date)
        .eq("period_id", input.period);

      if (attError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: attError.message });

      // Calculate overview per classroom
      return classrooms.map(room => {
        const roomStudents = allStudents.filter(s => s.classroom_id === room.id);
        const roomAttendance = attendance.filter(a => a.classroom_id === room.id);

        const hasData = roomAttendance.length > 0;
        const total = roomStudents.length;

        const present = roomAttendance.filter(a => a.status_name === "มา").length;
        const absent = roomAttendance.filter(a => a.status_name === "ขาด").length;
        const late = roomAttendance.filter(a => a.status_name === "สาย").length;
        const leave = roomAttendance.filter(a => a.status_name === "ลา").length;
        const sick = roomAttendance.filter(a => a.status_name === "ป่วย").length;

        const rate = total > 0 && hasData ? Math.round((present / total) * 100) : null;

        return {
          classroomId: room.id,
          classroomName: room.name,
          total,
          present,
          absent,
          late,
          leave,
          sick,
          rate,
          hasData
        };
      });
    }),

  sendDailySummary: adminProcedure
    .input(z.object({ 
      startDate: z.string(), 
      endDate: z.string(), 
      period: z.string().optional() 
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // 1. Get Config
        const { data: config } = await ctx.supabase.from("school_config").select("*").eq("id", 1).single();
        if (!config?.line_channel_access_token || !config?.line_target_id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ยังไม่ได้ตั้งค่า LINE Messaging API ในเมนูตั้งค่า" });
        }

        // 2. Get Data
        let query = ctx.supabase.from("attendance")
          .select("*")
          .gte("date", input.startDate)
          .lte("date", input.endDate);
        
        if (input.period) query = query.eq("period_id", input.period);
        
        const { data: attData, error: err } = await query;
        if (err) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });

        const counts = { มา: 0, ขาด: 0, สาย: 0, ลา: 0, ป่วย: 0 };
        attData.forEach(a => {
          if (a.status_name in counts) counts[a.status_name as keyof typeof counts]++;
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        
        const formatPercent = (count: number) => {
          if (total === 0) return "0.00";
          return ((count / total) * 100).toFixed(2);
        };

        const thaiStartDate = new Date(input.startDate).toLocaleDateString('th-TH', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        const thaiEndDate = new Date(input.endDate).toLocaleDateString('th-TH', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        let periodName = "ภาพรวมทั้งหมด";
        if (input.period) {
          const { data: p } = await ctx.supabase.from("periods").select("name").eq("id", input.period).single();
          periodName = p?.name || input.period;
        }

        const reporterName = (ctx.user as any)?.name || ctx.user?.username || "ผู้ดูแลระบบ";

        const dateStr = input.startDate === input.endDate 
          ? `ประจำวันที่ ${thaiStartDate}`
          : `ระหว่างวันที่ ${thaiStartDate} ถึง ${thaiEndDate}`;

        const message = `📢 สรุปรายงานการเข้าร่วม [${periodName}]\n--------------------------\n📅 ${dateStr}\n✅ มา: ${counts.มา}  คิดเป็น ${formatPercent(counts.มา)} %\n❌ ขาด: ${counts.ขาด}  คิดเป็น ${formatPercent(counts.ขาด)} %\n⏰ สาย: ${counts.สาย}  คิดเป็น ${formatPercent(counts.สาย)} %\n👤 ลา: ${counts.ลา}  คิดเป็น ${formatPercent(counts.ลา)} %\n💊 ป่วย: ${counts.ป่วย}  คิดเป็น ${formatPercent(counts.ป่วย)} %\n📊 รวมบันทึกแล้ว: ${total} รายการ\n--------------------------\nผู้รายงาน: ${reporterName}`;

        const response = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.line_channel_access_token}`,
          },
          body: JSON.stringify({
            to: config.line_target_id,
            messages: [{ type: "text", text: message }]
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          console.error("LINE API Error:", errBody);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ส่งข้อมูลไปที่ LINE ไม่สำเร็จ" });
        }

        return { success: true };
      } catch (err: any) {
        console.error("sendDailySummary Error:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
  createTeacher: adminProcedure
    .input(z.object({
      name: z.string(),
      username: z.string(),
      password: z.string(),
      role: z.enum(["teacher", "admin", "viewer"]),
      classroomIds: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("teachers")
        .insert({
          name: input.name,
          username: input.username,
          password: input.password,
          role: input.role,
          classroom_ids: input.classroomIds || "",
          status: 1,
        });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  updateTeacher: protectedProcedure
    .input(z.object({
      id: z.coerce.number(),
      name: z.string(),
      username: z.string(),
      password: z.string().optional(),
      role: z.enum(["teacher", "admin", "viewer"]),
      classroomIds: z.string().optional(),
      notifyTime: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Security check: Only admin can update other teachers or change role/classrooms
      const isAdmin = ctx.user.role === "admin";
      const isSelf = ctx.user.id === input.id;

      if (!isAdmin && !isSelf) {
        throw new TRPCError({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้อื่น" });
      }

      const updates: any = {
        name: input.name,
        username: input.username,
        notify_time: input.notifyTime,
      };

      // Only admin can change role or classrooms
      if (isAdmin) {
        updates.role = input.role;
        updates.classroom_ids = input.classroomIds;
      }

      if (input.password) updates.password = input.password;

      const { error } = await ctx.supabase
        .from("teachers")
        .update(updates)
        .eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  deleteTeacher: adminProcedure
    .input(z.object({ id: z.coerce.number() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("teachers")
        .update({ status: 0 })
        .eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  updatePeriodStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("periods")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  createStudent: adminProcedure
    .input(z.object({
      studentId: z.string(),
      classroomId: z.string(),
      no: z.number(),
      name: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("students")
        .insert({
          student_id: input.studentId,
          classroom_id: input.classroomId,
          no: input.no,
          name: input.name,
          status: 1,
        });
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  updateStudent: adminProcedure
    .input(z.object({
      id: z.coerce.number(),
      studentId: z.string(),
      classroomId: z.string(),
      no: z.number(),
      name: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("students")
        .update({
          student_id: input.studentId,
          classroom_id: input.classroomId,
          no: input.no,
          name: input.name,
        })
        .eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  deleteStudent: adminProcedure
    .input(z.object({ id: z.coerce.number() }))
    .mutation(async ({ input, ctx }) => {
      const { error } = await ctx.supabase
        .from("students")
        .update({ status: 0 })
        .eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  importStudents: adminProcedure
    .input(z.object({
      students: z.array(z.object({
        studentId: z.string(),
        classroomId: z.string(),
        no: z.number(),
        name: z.string(),
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const records = input.students.map(s => ({
        student_id: s.studentId,
        classroom_id: s.classroomId,
        no: s.no,
        name: s.name,
        status: 1,
      }));

      const { error } = await ctx.supabase
        .from("students")
        .upsert(records, { onConflict: 'student_id' });

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true, count: records.length };
    }),


  updateAttendanceRecord: adminProcedure
    .input(z.object({
      id: z.number(),
      teacher: z.string(),
      students: z.array(z.object({
        student_id: z.string(),
        status: z.string(),
        reason: z.string().optional().nullable(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Get original record metadata
      const { data: original, error: getError } = await ctx.supabase
        .from("attendance")
        .select("date, period_id, classroom_id")
        .eq("id", input.id)
        .limit(1)
        .single();

      if (getError || !original) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });

      // 2. Find teacher ID
      const { data: teacher, error: teacherError } = await ctx.supabase
        .from("teachers")
        .select("id")
        .eq("username", input.teacher)
        .single();

      if (teacherError || !teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found" });

      // 3. Update entries
      // Since it's a batch update for a specific date/period/room, 
      // we can just upsert the specific students provided
      const entries = input.students.map(s => ({
        student_id: s.student_id,
        classroom_id: original.classroom_id,
        period_id: original.period_id,
        date: original.date,
        status_name: s.status,
        notes: s.reason || "",
        teacher_id: teacher.id,
      }));

      const { error: upsertError } = await ctx.supabase
        .from("attendance")
        .upsert(entries, { onConflict: 'student_id,date,period_id' });

      if (upsertError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: upsertError.message });
      return { success: true };
    }),

  deleteAttendance: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Get record to delete all students for that date/period/room
      const { data: record, error: getError } = await ctx.supabase
        .from("attendance")
        .select("date, period_id, classroom_id")
        .eq("id", input.id)
        .single();

      if (getError || !record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });

      const { error } = await ctx.supabase
        .from("attendance")
        .delete()
        .eq("date", record.date)
        .eq("period_id", record.period_id)
        .eq("classroom_id", record.classroom_id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});

export type AppRouter = typeof appRouter;
