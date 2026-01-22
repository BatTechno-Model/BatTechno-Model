import PDFDocument from 'pdfkit';
import { computeStudentCourseMetrics } from './metrics.js';
import prisma from '../config/database.js';

/**
 * Helper function to draw a table in PDF
 */
function drawTable(doc, table, startX, startY, options = {}) {
  const {
    columnWidths = [],
    headerHeight = 30,
    rowHeight = 25,
    headerColor = '#1e40af',
    headerTextColor = '#ffffff',
    cellPadding = 5,
    borderColor = '#000000',
    fontSize = 10,
    headerFontSize = 11,
  } = options;

  let currentY = startY;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableWidth = columnWidths.length > 0 
    ? columnWidths.reduce((sum, w) => sum + w, 0)
    : pageWidth - (startX * 2);
  const tableStartX = startX;

  // Draw header
  if (table.headers && table.headers.length > 0) {
    let currentX = tableStartX;
    
    // Draw header background
    doc.rect(tableStartX, currentY, tableWidth, headerHeight)
      .fill(headerColor);
    
    table.headers.forEach((header, colIndex) => {
      const width = columnWidths[colIndex] || (tableWidth / table.headers.length);
      
      // Draw header text
      doc.fontSize(headerFontSize)
        .fillColor(headerTextColor)
        .text(String(header || ''), currentX + cellPadding, currentY + (headerHeight - headerFontSize) / 2, {
          width: width - (cellPadding * 2),
          align: 'center',
        });
      
      // Draw border
      doc.rect(currentX, currentY, width, headerHeight)
        .lineWidth(1)
        .stroke(borderColor);
      
      currentX += width;
    });
    
    currentY += headerHeight;
  }

  // Draw rows
  if (table.rows && table.rows.length > 0) {
    table.rows.forEach((row, rowIndex) => {
      let currentX = tableStartX;
      const isEvenRow = rowIndex % 2 === 0;
      const rowBgColor = isEvenRow ? '#f9fafb' : '#ffffff';
      
      // Draw row background
      doc.rect(tableStartX, currentY, tableWidth, rowHeight)
        .fill(rowBgColor);
      
      row.forEach((cell, colIndex) => {
        const width = columnWidths[colIndex] || (tableWidth / row.length);
        
        // Draw cell text
        doc.fontSize(fontSize)
          .fillColor('#000000')
          .text(String(cell || ''), currentX + cellPadding, currentY + (rowHeight - fontSize) / 2, {
            width: width - (cellPadding * 2),
            align: 'center',
          });
        
        // Draw border
        doc.rect(currentX, currentY, width, rowHeight)
          .lineWidth(1)
          .stroke(borderColor);
        
        currentX += width;
      });
      
      currentY += rowHeight;
    });
  }

  return currentY;
}

/**
 * Generate PDF report for a student
 */
export async function generateStudentReportPDF(student) {
  // Pre-fetch all data before generating PDF
  const enrollmentsWithData = await Promise.all(
    student.enrollments.map(async (enrollment) => {
      const courseId = enrollment.courseId;
      
      // Get metrics
      let metrics;
      try {
        metrics = await computeStudentCourseMetrics(student.id, courseId);
      } catch (error) {
        metrics = {
          attendanceRate: 0,
          assignmentCompletionRate: 0,
          assignmentQuality: 0,
          examsAvg: 0,
          overallScore: 0,
          alerts: [],
          recommendations: [],
        };
      }

      // Get attendance summary
      const sessions = await prisma.session.findMany({
        where: { courseId },
        include: {
          attendances: {
            where: { studentId: student.id },
          },
        },
      });

      const attendanceSummary = {
        total: sessions.length,
        present: sessions.filter((s) => s.attendances[0]?.status === 'PRESENT').length,
        absent: sessions.filter((s) => !s.attendances[0] || s.attendances[0].status === 'ABSENT').length,
        late: sessions.filter((s) => s.attendances[0]?.status === 'LATE').length,
        excused: sessions.filter((s) => s.attendances[0]?.status === 'EXCUSED').length,
      };

      // Get assignments summary
      const assignments = await prisma.assignment.findMany({
        where: { courseId, isPublished: true },
        include: {
          submissions: {
            where: { studentId: student.id },
            include: {
              reviews: true,
            },
          },
        },
      });

      const assignmentSummary = {
        total: assignments.length,
        submitted: assignments.filter((a) => a.submissions.length > 0).length,
        approved: assignments.filter((a) => a.submissions[0]?.status === 'APPROVED').length,
        needsChanges: assignments.filter((a) => a.submissions[0]?.status === 'NEEDS_CHANGES').length,
      };

      // Get exams summary
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: {
          studentId: student.id,
          quiz: { courseId },
          status: 'SUBMITTED',
        },
      });

      const examAttempts = await prisma.examAttempt.findMany({
        where: {
          studentId: student.id,
          exam: { courseId },
          status: 'SUBMITTED',
        },
      });

      return {
        enrollment,
        metrics,
        attendanceSummary,
        assignmentSummary,
        quizAttempts,
        examAttempts,
      };
    })
  );

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .fillColor('#1e40af')
        .text('BatTechno', 50, 50, { align: 'center' })
        .fontSize(12)
        .fillColor('#666')
        .text(`Report Date: ${new Date().toLocaleDateString()}`, 50, 80, { align: 'center' })
        .moveDown(2);

      // Student Name
      const studentName = student.profile?.fullName4 || student.name;
      doc
        .fontSize(18)
        .fillColor('#000')
        .text(`Student Report: ${studentName}`, { align: 'center' })
        .moveDown();

      // Profile Overview Section
      doc.fontSize(16).fillColor('#1e40af').text('Profile Overview', { underline: true }).moveDown(0.5);

      const profile = student.profile || {};
      const profileRows = [
        ['Email', student.email],
        ['Phone', profile.phone || 'N/A'],
        ['Country', profile.country || 'N/A'],
        ['City', profile.city || 'N/A'],
        ['Is Student', profile.isStudent ? 'Yes' : 'No'],
      ];

      if (profile.isStudent) {
        profileRows.push(['University', profile.university || 'N/A']);
        profileRows.push(['Major', profile.major || 'N/A']);
        if (profile.educationLevel) profileRows.push(['Education Level', profile.educationLevel]);
        if (profile.graduationYear) profileRows.push(['Graduation Year', String(profile.graduationYear)]);
      }

      if (profile.bio) {
        profileRows.push(['Bio', profile.bio]);
      }

      if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
        profileRows.push(['Skills', profile.skills.join(', ')]);
      }

      if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0) {
        profileRows.push(['Interests', profile.interests.join(', ')]);
      }

      const profileTable = {
        headers: ['Field', 'Value'],
        rows: profileRows,
      };

      const profileTableY = drawTable(doc, profileTable, 50, doc.y, {
        columnWidths: [150, 350],
        headerHeight: 30,
        rowHeight: 25,
      });

      doc.y = profileTableY + 20;

      // Course Performance Sections
      for (const {
        enrollment,
        metrics,
        attendanceSummary,
        assignmentSummary,
        quizAttempts,
        examAttempts,
      } of enrollmentsWithData) {
        const course = enrollment.course;

        doc.addPage();
        doc.fontSize(16).fillColor('#1e40af').text(`Course: ${course.title}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#000');

        // Attendance Summary Table
        doc.fontSize(14).fillColor('#1e40af').text('Attendance Summary', { underline: true });
        doc.moveDown(0.5);
        
        const attendanceTable = {
          headers: ['Status', 'Count', 'Percentage'],
          rows: [
            ['Total Sessions', String(attendanceSummary.total), '100%'],
            ['Present', String(attendanceSummary.present), attendanceSummary.total > 0 ? `${((attendanceSummary.present / attendanceSummary.total) * 100).toFixed(1)}%` : '0%'],
            ['Absent', String(attendanceSummary.absent), attendanceSummary.total > 0 ? `${((attendanceSummary.absent / attendanceSummary.total) * 100).toFixed(1)}%` : '0%'],
            ['Late', String(attendanceSummary.late), attendanceSummary.total > 0 ? `${((attendanceSummary.late / attendanceSummary.total) * 100).toFixed(1)}%` : '0%'],
            ['Excused', String(attendanceSummary.excused), attendanceSummary.total > 0 ? `${((attendanceSummary.excused / attendanceSummary.total) * 100).toFixed(1)}%` : '0%'],
            ['Attendance Rate', `${(metrics.attendanceRate * 100).toFixed(1)}%`, '-'],
          ],
        };

        const attendanceTableY = drawTable(doc, attendanceTable, 50, doc.y, {
          columnWidths: [200, 150, 150],
          headerHeight: 30,
          rowHeight: 25,
        });

        doc.y = attendanceTableY + 20;

        // Assignments Summary Table
        doc.fontSize(14).fillColor('#1e40af').text('Assignments Summary', { underline: true });
        doc.moveDown(0.5);
        
        const assignmentsTable = {
          headers: ['Metric', 'Value', 'Percentage'],
          rows: [
            ['Total Assignments', String(assignmentSummary.total), '100%'],
            ['Submitted', String(assignmentSummary.submitted), assignmentSummary.total > 0 ? `${((assignmentSummary.submitted / assignmentSummary.total) * 100).toFixed(1)}%` : '0%'],
            ['Approved', String(assignmentSummary.approved), assignmentSummary.submitted > 0 ? `${((assignmentSummary.approved / assignmentSummary.submitted) * 100).toFixed(1)}%` : '0%'],
            ['Needs Changes', String(assignmentSummary.needsChanges), assignmentSummary.submitted > 0 ? `${((assignmentSummary.needsChanges / assignmentSummary.submitted) * 100).toFixed(1)}%` : '0%'],
            ['Completion Rate', `${(metrics.assignmentCompletionRate * 100).toFixed(1)}%`, '-'],
            ['Quality Score', `${(metrics.assignmentQuality * 100).toFixed(1)}%`, '-'],
          ],
        };

        const assignmentsTableY = drawTable(doc, assignmentsTable, 50, doc.y, {
          columnWidths: [200, 150, 150],
          headerHeight: 30,
          rowHeight: 25,
        });

        doc.y = assignmentsTableY + 20;

        // Exams Summary Table
        doc.fontSize(14).fillColor('#1e40af').text('Exams/Quizzes Summary', { underline: true });
        doc.moveDown(0.5);
        
        // Calculate individual averages
        let quizAvg = 0;
        if (quizAttempts.length > 0) {
          const quizTotal = quizAttempts.reduce((sum, q) => sum + (q.percentage || 0), 0);
          quizAvg = (quizTotal / quizAttempts.length) * 10;
        }
        
        let examAvg = 0;
        if (examAttempts.length > 0) {
          const examTotal = examAttempts.reduce((sum, e) => sum + (e.finalScore10 || 0), 0);
          examAvg = examTotal / examAttempts.length;
        }
        
        const examsTable = {
          headers: ['Type', 'Attempts', 'Average Score'],
          rows: [
            ['Quizzes', String(quizAttempts.length), quizAttempts.length > 0 ? `${quizAvg.toFixed(1)}/10` : 'N/A'],
            ['Exams', String(examAttempts.length), examAttempts.length > 0 ? `${examAvg.toFixed(1)}/10` : 'N/A'],
            ['Total', String(quizAttempts.length + examAttempts.length), `${(metrics.examsAvg * 10).toFixed(1)}/10`],
          ],
        };

        const examsTableY = drawTable(doc, examsTable, 50, doc.y, {
          columnWidths: [200, 150, 150],
          headerHeight: 30,
          rowHeight: 25,
        });

        doc.y = examsTableY + 20;

        // Overall Score Table
        doc.fontSize(14).fillColor('#1e40af').text('Overall Score', { underline: true });
        doc.moveDown(0.5);
        
        const overallScoreTable = {
          headers: ['Component', 'Score', 'Weight'],
          rows: [
            ['Attendance Rate', `${(metrics.attendanceRate * 100).toFixed(1)}%`, '30%'],
            ['Assignments', `${((metrics.assignmentCompletionRate * 0.5 + metrics.assignmentQuality * 0.5) * 100).toFixed(1)}%`, '40%'],
            ['Exams/Quizzes', `${(metrics.examsAvg * 100).toFixed(1)}%`, '30%'],
            ['Overall Score', `${metrics.overallScore.toFixed(1)}/100`, '100%'],
          ],
        };

        const overallScoreTableY = drawTable(doc, overallScoreTable, 50, doc.y, {
          columnWidths: [200, 150, 150],
          headerHeight: 30,
          rowHeight: 25,
        });

        doc.y = overallScoreTableY + 20;

        // Alerts
        if (metrics.alerts && metrics.alerts.length > 0) {
          doc.fontSize(14).fillColor('#dc2626').text('Alerts', { underline: true }).moveDown(0.5);
          doc.fontSize(11).fillColor('#000');
          metrics.alerts.forEach((alert) => {
            doc.text(`• ${alert}`, { indent: 20 });
          });
          doc.moveDown();
        }

        // Recommendations
        if (metrics.recommendations && metrics.recommendations.length > 0) {
          doc.fontSize(14).fillColor('#059669').text('Recommendations', { underline: true }).moveDown(0.5);
          doc.fontSize(11).fillColor('#000');
          metrics.recommendations.forEach((rec) => {
            doc.text(`• ${rec}`, { indent: 20 });
          });
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF report for subscribers list
 */
export async function generateSubscribersPDF(subscribers) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc
        .fontSize(24)
        .fillColor('#1e40af')
        .text('BatTechno - Subscribers Report', 50, 50, { align: 'center' })
        .fontSize(12)
        .fillColor('#666')
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80, { align: 'center' })
        .moveDown(2);

      // Subscribers list
      doc.fontSize(16).fillColor('#1e40af').text('Subscribers List', { underline: true }).moveDown();

      if (subscribers.length === 0) {
        doc.fontSize(12).fillColor('#000').text('No subscribers found.');
      } else {
        subscribers.forEach((subscriber, index) => {
          const profile = subscriber.profile || {};
          
          if (index > 0 && index % 3 === 0) {
            doc.addPage();
          }

          doc.fontSize(14).fillColor('#000').text(`${index + 1}. ${profile.fullName4 || subscriber.name || 'N/A'}`, { bold: true });
          doc.fontSize(10);
          doc.text(`Email: ${subscriber.email}`);
          if (profile.phone) doc.text(`Phone: ${profile.phone}`);
          if (profile.city || profile.country) {
            doc.text(`Location: ${[profile.city, profile.country].filter(Boolean).join(', ')}`);
          }
          if (profile.isStudent !== undefined) {
            doc.text(`Student: ${profile.isStudent ? 'Yes' : 'No'}`);
          }
          if (profile.university) doc.text(`University: ${profile.university}`);
          if (profile.major) doc.text(`Major: ${profile.major}`);
          if (profile.heardFrom) doc.text(`Heard From: ${profile.heardFrom}`);
          if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
            doc.text(`Skills: ${profile.skills.join(', ')}`);
          }
          doc.moveDown();
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
