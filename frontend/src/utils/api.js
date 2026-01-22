const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Helper function to build image URL
export const getImageUrl = (path) => {
  if (!path) return null;
  
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Get base URL without /api/v1
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1')
    .replace(/\/api\/v1$/, '');
  
  // Ensure path starts with /
  const imagePath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${imagePath}`;
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      return data.accessToken;
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(endpoint, options = {}, retryCount = 0) {
  const token = localStorage.getItem('accessToken');
  
  // Check if body is FormData
  const isFormData = options.body instanceof FormData;
  
  // Build headers object
  const headers = {};
  
  // Don't set Content-Type for FormData - browser will set it with boundary automatically
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Always add Authorization header if token exists and is valid
  if (token && typeof token === 'string' && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
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
    let response;
    let data;
    
    try {
      response = await fetch(`${API_URL}${endpoint}`, config);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (fetchError) {
      // Handle network errors (connection refused, timeout, etc.)
      if (fetchError instanceof TypeError) {
        const isConnectionRefused = fetchError.message.includes('Failed to fetch') || 
                                    fetchError.message.includes('ERR_CONNECTION_REFUSED') ||
                                    fetchError.message.includes('NetworkError');
        
        if (isConnectionRefused) {
          const errorMessage = 'Cannot connect to server. Please make sure the backend server is running on port 5000.';
          console.error('Connection error:', errorMessage);
          throw new ApiError(errorMessage, 0);
        }
      }
      // Re-throw other errors
      throw fetchError;
    }

    // Handle 429 errors - Too Many Requests with exponential backoff retry
    if (response.status === 429) {
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        // Get retry-after header or use exponential backoff
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
        
        console.warn(`Rate limit hit (429). Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Retry the request
        return request(endpoint, options, retryCount + 1);
      } else {
        // Max retries reached
        const errorMessage = typeof data === 'object' 
          ? (data.error || data.message || 'Too many requests. Please wait a moment and try again.')
          : 'Too many requests. Please wait a moment and try again.';
        throw new ApiError(errorMessage, 429);
      }
    }

    // Handle 401 errors - try to refresh token if we have a refresh token
    if (response.status === 401 && retryCount === 0) {
      const errorMessage = typeof data === 'object' ? (data.error || data.message) : (data || 'Unauthorized');
      const hasRefreshToken = localStorage.getItem('refreshToken');
      
      // Try to refresh token if we have one and the error suggests token issues
      if (hasRefreshToken && (errorMessage === 'Token expired' || errorMessage === 'Invalid token')) {
        try {
          console.log('Attempting to refresh token due to 401 error:', errorMessage);
          await refreshAccessToken();
          // Retry the request with new token
          return request(endpoint, options, retryCount + 1);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          throw new ApiError('Session expired. Please login again.', 401);
        }
      }
      
      // If no refresh token or token is missing/invalid, clear tokens
      if (!hasRefreshToken || errorMessage === 'Access token required' || errorMessage === 'Invalid token') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Only redirect if we're not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'object' 
        ? (data.error || data.message || 'Request failed')
        : (data || 'Request failed');
      const fullMessage = typeof data === 'object' && data.command 
        ? `${errorMessage}\n\nRun: ${data.command}` 
        : errorMessage;
      
      console.error('API Error:', {
        status: response.status,
        endpoint,
        error: errorMessage,
        message: data.message,
        command: data.command,
        details: data.details,
        fullData: data,
      });
      
      // Show alert for migration errors
      if (data.error === 'Database migration required' && data.command) {
        alert(`⚠️ ${errorMessage}\n\nPlease run this command in your terminal:\n\n${data.command}\n\nThen restart your backend server.`);
      }
      
      throw new ApiError(fullMessage, response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError) {
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('ERR_CONNECTION_REFUSED') ||
          error.message.includes('NetworkError')) {
        throw new ApiError('Cannot connect to server. Please make sure the backend server is running.', 0);
      }
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
  
  getInstructors: () => request('/courses/instructors'),
  
  enrollStudents: (courseId, studentIds) => request(`/courses/${courseId}/enrollments`, {
    method: 'POST',
    body: { studentIds },
  }),
  
  getCourseStudents: (courseId) => request(`/courses/${courseId}/students`),
  
  // Sessions
  getSessions: (courseId) => request(`/sessions/course/${courseId}`),
  
  getAllSessions: () => request('/sessions/all'),
  
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
  
  // Quizzes
  createQuiz: (courseId, sessionId, data) => request(`/courses/${courseId}/sessions/${sessionId}/quizzes`, {
    method: 'POST',
    body: data,
  }),
  
  getQuizzes: (sessionId) => request(`/sessions/${sessionId}/quizzes`),
  
  getQuiz: (quizId) => request(`/quizzes/${quizId}`),
  
  updateQuiz: (quizId, data) => request(`/quizzes/${quizId}`, {
    method: 'PUT',
    body: data,
  }),
  
  updateQuizStatus: (quizId, status) => request(`/quizzes/${quizId}/status`, {
    method: 'PUT',
    body: { status },
  }),
  
  deleteQuiz: (quizId) => request(`/quizzes/${quizId}`, {
    method: 'DELETE',
  }),
  
  getQuizQuestions: (quizId) => request(`/quizzes/${quizId}/questions`),
  
  getQuizAttempts: (quizId) => request(`/quizzes/${quizId}/attempts`),
  
  getAllQuizResults: () => request('/quizzes/results/all'),
  
  // Questions
  createQuestion: (quizId, data) => request(`/quizzes/${quizId}/questions`, {
    method: 'POST',
    body: data,
  }),
  
  updateQuestion: (questionId, data) => request(`/questions/${questionId}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteQuestion: (questionId) => request(`/questions/${questionId}`, {
    method: 'DELETE',
  }),
  
  reorderQuestions: (quizId, questionIds) => request(`/quizzes/${quizId}/questions/reorder`, {
    method: 'PUT',
    body: { questionIds },
  }),
  
  // Student quiz attempts
  getMyQuizzes: () => request('/my/quizzes'),
  
  startQuizAttempt: (quizId) => request(`/quizzes/${quizId}/attempts/start`, {
    method: 'POST',
  }),
  
  submitAnswer: (attemptId, questionId, answer) => request(`/attempts/${attemptId}/answer`, {
    method: 'POST',
    body: { questionId, answer },
  }),
  
  submitAttempt: (attemptId) => request(`/attempts/${attemptId}/submit`, {
    method: 'POST',
  }),
  
  getMyEvaluations: () => request('/my/evaluations'),
  
  // Analytics (Admin)
  getSessionEvaluations: (sessionId) => request(`/sessions/${sessionId}/evaluations`),
  
  getCourseEvaluations: (courseId) => request(`/courses/${courseId}/evaluations`),
  
  getStudentEvaluations: (studentId) => request(`/students/${studentId}/evaluations`),
  
  exportSessionEvaluations: (sessionId) => {
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_URL}/sessions/${sessionId}/evaluations/export`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }).then((res) => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    }).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluations-${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  },
  
  exportCourseEvaluations: (courseId) => {
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_URL}/courses/${courseId}/evaluations/export`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }).then((res) => {
      if (!res.ok) throw new Error('Export failed');
      return res.blob();
    }).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluations-course-${courseId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  },

  // ========== EXAMS API ==========
  
  // Admin exam management
  createExam: (sessionId, data) => request(`/sessions/${sessionId}/exams`, {
    method: 'POST',
    body: data,
  }),
  
  getSessionExams: (sessionId) => request(`/sessions/${sessionId}/exams`),
  
  getExam: (examId) => request(`/exams/${examId}`),
  
  updateExam: (examId, data) => request(`/exams/${examId}`, {
    method: 'PUT',
    body: data,
  }),
  
  updateExamStatus: (examId, status) => request(`/exams/${examId}/status`, {
    method: 'PUT',
    body: { status },
  }),
  
  // Question management
  createExamQuestion: (examId, data) => request(`/exams/${examId}/questions`, {
    method: 'POST',
    body: data,
  }),
  
  updateExamQuestion: (questionId, data) => request(`/questions/${questionId}`, {
    method: 'PUT',
    body: data,
  }),
  
  deleteExamQuestion: (questionId) => request(`/questions/${questionId}`, {
    method: 'DELETE',
  }),
  
  getExamQuestions: (examId) => request(`/exams/${examId}/questions`),
  
  reorderExamQuestions: (examId, orderedIds) => request(`/exams/${examId}/questions/reorder`, {
    method: 'PUT',
    body: { orderedIds },
  }),
  
  duplicateExamQuestion: (questionId) => request(`/questions/${questionId}/duplicate`, {
    method: 'POST',
  }),
  
  bulkUpdateExamQuestions: (examId, questions) => request(`/exams/${examId}/questions/bulk`, {
    method: 'PUT',
    body: { questions },
  }),
  
  // Student exam attempts
  getMyExams: () => request('/my/exams'),
  
  startExamAttempt: (examId) => request(`/exams/${examId}/attempts/start`, {
    method: 'POST',
  }),
  
  submitExamAnswer: (attemptId, questionId, answer) => request(`/attempts/${attemptId}/answer`, {
    method: 'POST',
    body: { questionId, answer },
  }),
  
  submitExamAttempt: (attemptId) => request(`/attempts/${attemptId}/submit`, {
    method: 'POST',
  }),
  
  getExamResult: (examId) => request(`/my/exams/${examId}/result`),
  
  getExamAttemptResult: (attemptId) => request(`/attempts/${attemptId}/result`),
  
  // Analytics (Admin)
  getSessionExamAnalytics: (sessionId) => request(`/sessions/${sessionId}/exams/analytics`),
  
  getCourseExamAnalytics: (courseId) => request(`/courses/${courseId}/exams/analytics`),
  
  // Profile
  getProfile: () => request('/profile'),
  
  updateProfile: (data) => request('/profile', {
    method: 'PUT',
    body: data,
  }),
  
  getProfileOptions: () => request('/profile/options'),
  
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_URL}/profile/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        let errorMessage = 'Failed to upload avatar';
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = res.statusText || errorMessage;
        }
        throw new ApiError(errorMessage, res.status);
      }
      return res.json();
    }).catch((error) => {
      // Ensure we always throw an ApiError
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Failed to upload avatar', error.status || 500);
    });
  },
  
  // Suggestions
  getSuggestions: (key, q, country) => {
    const params = new URLSearchParams({ key });
    if (q) params.append('q', q);
    if (country) params.append('country', country);
    return request(`/suggestions?${params.toString()}`);
  },
  
  // Admin - Students Directory
  getAdminStudents: (params) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.city) queryParams.append('city', params.city);
    if (params?.country) queryParams.append('country', params.country);
    if (params?.isStudent !== undefined) queryParams.append('isStudent', params.isStudent);
    if (params?.courseId) queryParams.append('courseId', params.courseId);
    if (params?.alertType) queryParams.append('alertType', params.alertType);
    if (params?.lowPerformance !== undefined) queryParams.append('lowPerformance', params.lowPerformance);
    if (params?.page) queryParams.append('page', params.page);
    if (params?.limit) queryParams.append('limit', params.limit);
    return request(`/admin/students?${queryParams.toString()}`);
  },
  
  // Admin - Student Report
  getStudentReport: (studentId) => request(`/admin/students/${studentId}/report`),
  
  downloadStudentReportPDF: (studentId) => {
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_URL}/admin/students/${studentId}/report.pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }).then((res) => {
      if (!res.ok) throw new Error('Failed to download PDF');
      return res.blob();
    }).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `student-report-${studentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  },

  // Admin - Subscribers
  getAdminSubscribers: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.city) queryParams.append('city', params.city);
    if (params?.country) queryParams.append('country', params.country);
    if (params?.isStudent !== undefined) queryParams.append('isStudent', params.isStudent);
    if (params?.page) queryParams.append('page', params.page);
    if (params?.limit) queryParams.append('limit', params.limit);
    return request(`/admin/subscribers?${queryParams.toString()}`);
  },

  downloadSubscribersPDF: (params = {}) => {
    const token = localStorage.getItem('accessToken');
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.city) queryParams.append('city', params.city);
    if (params?.country) queryParams.append('country', params.country);
    if (params?.isStudent !== undefined) queryParams.append('isStudent', params.isStudent);
    return fetch(`${API_URL}/admin/subscribers/pdf?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }).then((res) => {
      if (!res.ok) throw new Error('Failed to download PDF');
      return res.blob();
    }).then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subscribers-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  },
};

export default api;
