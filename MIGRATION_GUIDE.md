# Migration Guide - BatTechno Model Enhancements

## Summary of Changes

This update adds:
1. **Admin RBAC Enhancement** - ADMIN role now has all permissions automatically
2. **Assignment Publishing** - Assignments can be published/unpublished
3. **Assignment Resources** - Admins can upload files/links to assignments
4. **Strong Password Requirements** - Admin passwords must meet security standards
5. **Enhanced Dashboard** - Fixed viewport, beautiful animations, mobile-first
6. **Resource Management UI** - Full CRUD for assignment resources

## Modified Files

### Backend
- `backend/prisma/schema.prisma` - Added `isPublished` field and `AssignmentResource` model
- `backend/middleware/auth.js` - Enhanced RBAC to give ADMIN all permissions
- `backend/utils/password.js` - NEW: Password validation utility
- `backend/routes/assignments.js` - Added publish/unpublish endpoint, filtering for students
- `backend/routes/assignment-resources.js` - NEW: Resource management routes
- `backend/routes/auth.js` - Added admin password validation
- `backend/routes/users.js` - Added admin password validation
- `backend/server.js` - Added assignment-resources route
- `backend/prisma/seed.js` - Updated admin password, added resources

### Frontend
- `frontend/src/pages/Dashboard.jsx` - Complete redesign: fixed viewport, animations, gradients
- `frontend/src/pages/AssignmentDetail.jsx` - Added publish toggle, resource display
- `frontend/src/pages/CreateAssignment.jsx` - Added publish checkbox
- `frontend/src/components/AssignmentResources.jsx` - NEW: Resource management component
- `frontend/src/utils/api.js` - Added resource and publish endpoints
- `frontend/src/i18n/index.js` - Added new translation keys

### Database
- `database/neon_schema.sql` - Updated with new schema

## Migration Steps

### 1. Database Migration

**Option A: Using Prisma (Recommended)**
```bash
cd backend
npx prisma generate
npx prisma db push
```

**Option B: Using Neon SQL Editor**
1. Open Neon SQL Editor
2. Copy contents from `database/neon_schema.sql`
3. Run the script (it will add new columns/tables)

### 2. Update Seed Data

```bash
cd backend
npm run seed
```

**New Admin Credentials:**
- Email: `admin@battechno.com`
- Password: `Admin@123Strong!` (DEV ONLY - change in production!)

### 3. Restart Backend

```bash
cd backend
npm run dev
```

### 4. Restart Frontend

```bash
cd frontend
npm run dev
```

## New Features

### Admin Powers
- ✅ ADMIN automatically has access to all endpoints
- ✅ Can publish/unpublish assignments
- ✅ Can upload resources (files/links) to assignments
- ✅ Strong password requirements enforced

### Assignment Resources
- Admins can add files (PDF, ZIP, images) or links (GitHub, Figma, etc.)
- Resources visible to students on assignment detail page
- Students can download files or open links

### Dashboard Improvements
- Fixed viewport height (no scroll on mobile)
- Animated gradient header with floating blobs
- Today's sessions card
- Pending assignments card
- My courses with quick access
- Smooth animations throughout

## API Changes

### New Endpoints
- `PATCH /api/v1/assignments/:id/publish` - Publish/unpublish assignment
- `GET /api/v1/assignment-resources/assignment/:assignmentId` - Get resources
- `POST /api/v1/assignment-resources` - Create resource (with file upload)
- `DELETE /api/v1/assignment-resources/:id` - Delete resource

### Updated Endpoints
- `GET /api/v1/assignments/course/:courseId` - Now filters unpublished for students
- `GET /api/v1/assignments/:id` - Includes resources, checks publish status for students
- `POST /api/v1/assignments` - Accepts `isPublished` field
- `PUT /api/v1/assignments/:id` - Accepts `isPublished` field

## Breaking Changes

⚠️ **None** - All changes are backward compatible. Existing assignments will have `isPublished: false` by default.

## Verification Checklist

After migration, verify:
- [ ] Admin can create assignments
- [ ] Admin can publish/unpublish assignments
- [ ] Admin can upload resources to assignments
- [ ] Students only see published assignments
- [ ] Students can view/download assignment resources
- [ ] Dashboard displays correctly (no scroll on mobile)
- [ ] Animations work smoothly
- [ ] Admin password validation works
- [ ] All existing functionality still works

## Troubleshooting

### Database Errors
- Run `npx prisma generate` if you see Prisma client errors
- Check that `isPublished` column exists: `SELECT * FROM "Assignment" LIMIT 1;`
- Check that `AssignmentResource` table exists

### Frontend Errors
- Clear browser cache
- Check browser console for API errors
- Verify backend is running on port 5000

### Permission Errors
- Verify admin user has role 'ADMIN' in database
- Check JWT token includes correct role
- Test with admin credentials from seed

---

**Migration completed successfully!** 🎉
