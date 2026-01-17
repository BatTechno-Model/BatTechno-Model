const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('accessToken');
  
  // Check if body is FormData
  const isFormData = options.body instanceof FormData;
  
  // Build headers object
  const headers = {};
  
  // Don't set Content-Type for FormData - browser will set it with boundary automatically
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Always add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with any additional headers from options
  Object.assign(headers, options.headers || {});
  
  const config = {
    headers,
    ...options,
  };

  // Debug logging for auth endpoints
  if (endpoint.includes('/auth/me')) {
    console.log('Request to:', endpoint, 'with token:', token ? token.substring(0, 20) + '...' : 'none');
  }
  
  // Log submissions requests for debugging
  if (endpoint.includes('/submissions')) {
    console.log('Submissions request to:', endpoint, 'with token:', token ? 'yes' : 'no', 'isFormData:', isFormData);
  }

  // Only stringify if not FormData
  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = data.error || data.message || 'Request failed';
      console.error('API Error:', {
        status: response.status,
        endpoint,
        error: errorMessage,
        data,
      });
      throw new ApiError(errorMessage, response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network error', 0);
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: { email, password },
  }),
  
  register: (data) => request('/auth/register', {
    method: 'POST',
    body: data,
  }),
  
  refreshToken: (refreshToken) => request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  }),
  
  getMe: () => request('/auth/me'),
  
  // Users
  getUsers: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/users${query ? `?${query}` : ''}`);
  },
  
  createUser: (data) => request('/users', {
    method: 'POST',
    body: data,
  }),
  
  getUser: (id) => request(`/users/${id}`),
  
  updateUser: (id, data) => request(`/users/${id}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteUser: (id) => request(`/users/${id}`, {
    method: 'DELETE',
  }),
  
  // Courses
  getCourses: () => request('/courses'),
  
  getCourse: (id) => request(`/courses/${id}`),
  
  createCourse: (data) => request('/courses', {
    method: 'POST',
    body: data,
  }),
  
  updateCourse: (id, data) => request(`/courses/${id}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteCourse: (id) => request(`/courses/${id}`, {
    method: 'DELETE',
  }),
  
  enrollStudents: (courseId, studentIds) => request(`/courses/${courseId}/enrollments`, {
    method: 'POST',
    body: { studentIds },
  }),
  
  getCourseStudents: (courseId) => request(`/courses/${courseId}/students`),
  
  // Sessions
  getSessions: (courseId) => request(`/sessions/course/${courseId}`),
  
  getSession: (id) => request(`/sessions/${id}`),
  
  createSession: (data) => request('/sessions', {
    method: 'POST',
    body: data,
  }),
  
  bulkCreateSessions: (courseId, sessions) => request('/sessions/bulk', {
    method: 'POST',
    body: { courseId, sessions },
  }),
  
  updateSession: (id, data) => request(`/sessions/${id}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteSession: (id) => request(`/sessions/${id}`, {
    method: 'DELETE',
  }),
  
  // Attendance
  getAttendance: (sessionId) => request(`/attendance/session/${sessionId}`),
  
  bulkUpdateAttendance: (data) => request('/attendance/bulk', {
    method: 'POST',
    body: data,
  }),
  
  getAttendanceSummary: (studentId, courseId) => request(`/attendance/student/${studentId}/course/${courseId}`),
  
  getCourseAttendanceSummary: (courseId) => request(`/attendance/course/${courseId}/summary`),
  
  getAllStudentsAttendanceSummary: () => request('/attendance/students/summary'),
  
  // Assignments
  getAssignments: (courseId) => request(`/assignments/course/${courseId}`),
  
  getAssignment: (id) => request(`/assignments/${id}`),
  
  createAssignment: (data) => request('/assignments', {
    method: 'POST',
    body: data,
  }),
  
  updateAssignment: (id, data) => request(`/assignments/${id}`, {
    method: 'PUT',
    body: data,
  }),
  
  publishAssignment: (id, isPublished) => request(`/assignments/${id}/publish`, {
    method: 'PATCH',
    body: { isPublished },
  }),

  deleteAssignment: (id) => request(`/assignments/${id}`, {
    method: 'DELETE',
  }),
  
  // Assignment Resources
  getAssignmentResources: (assignmentId) => request(`/assignment-resources/assignment/${assignmentId}`),
  
  createAssignmentResource: (data, file) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('No access token found for creating assignment resource');
      return Promise.reject(new Error('Authentication required'));
    }
    
    const formData = new FormData();
    formData.append('assignmentId', data.assignmentId);
    formData.append('type', data.type);
    formData.append('name', data.name || '');
    if (data.type === 'LINK') {
      formData.append('url', data.url || '');
    }
    if (file) {
      formData.append('file', file);
    }
    
    console.log('Creating assignment resource:', { assignmentId: data.assignmentId, type: data.type, hasFile: !!file, token: token ? 'yes' : 'no' });
    
    return request('/assignment-resources', {
      method: 'POST',
      body: formData,
      // Headers will be set automatically by request() function (including Authorization)
    });
  },
  
  deleteAssignmentResource: (id) => request(`/assignment-resources/${id}`, {
    method: 'DELETE',
  }),
  
  // Submissions
  getSubmissions: (assignmentId) => {
    if (!assignmentId) {
      console.error('getSubmissions called without assignmentId');
      return Promise.reject(new Error('Assignment ID is required'));
    }
    return request(`/submissions/assignment/${assignmentId}`);
  },
  
  getSubmission: (id) => request(`/submissions/${id}`),
  
  createSubmission: (assignmentId, data, files) => {
    if (!assignmentId) {
      console.error('createSubmission called without assignmentId');
      return Promise.reject(new Error('Assignment ID is required'));
    }
    
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('No access token found for submission');
      return Promise.reject(new Error('Authentication required'));
    }
    
    const formData = new FormData();
    formData.append('assignmentId', assignmentId);
    formData.append('note', data.note || '');
    formData.append('assets', JSON.stringify(data.assets || []));
    
    if (files && files.length > 0) {
      console.log(`Adding ${files.length} files to submission`);
      files.forEach((file) => {
        console.log(`Adding file: ${file.name} (${file.type}, ${file.size} bytes)`);
        formData.append('files', file);
      });
    }
    
    console.log('Creating submission for assignment:', assignmentId, 'with token:', token ? 'yes' : 'no');
    console.log('FormData entries:', Array.from(formData.entries()).map(([k, v]) => [k, v instanceof File ? `${v.name} (${v.size} bytes)` : v]));
    
    return request('/submissions', {
      method: 'POST',
      body: formData,
      // Headers will be set automatically by request() function
    });
  },
  
  updateSubmissionStatus: (id, status, note) => request(`/submissions/${id}/status`, {
    method: 'PATCH',
    body: { status, note },
  }),
  
  // Reviews
  createReview: (data) => request('/reviews', {
    method: 'POST',
    body: data,
  }),
  
  getReviews: (submissionId) => request(`/reviews/submission/${submissionId}`),
};

export default api;
