import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { validateLoginEmail, validateLoginPassword, validateLoginForm } from '../utils/validation';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../utils/api';

/**
 * Login Page Component
 * Implements robust client-side form validation, Show/Hide password toggle,
 * accessible Bootstrap form controls, and JWT authentication via AuthContext.
 *
 * NOTE: No jQuery is used on this page; React controls state and rendering completely.
 * Passwords are never stored in localStorage, sessionStorage, console logs, or URLs.
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    password: false
  });
  const [errors, setErrors] = useState({});
  const [formErrorAlert, setFormErrorAlert] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  // Validate a single field
  const validateField = (name, value) => {
    if (name === 'email') {
      return validateLoginEmail(value);
    }
    if (name === 'password') {
      return validateLoginPassword(value);
    }
    return { isValid: true };
  };

  // Handle field change with immediate feedback if already touched
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (touched[name]) {
        const validation = validateField(name, value);
        setErrors((prevErr) => ({
          ...prevErr,
          [name]: validation.isValid ? null : validation.message
        }));
      }

      return updated;
    });
  };

  // Handle field blur
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const validation = validateField(name, value);
    setErrors((prevErr) => ({
      ...prevErr,
      [name]: validation.isValid ? null : validation.message
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ email: true, password: true });

    // Validate entire form
    const { isValid, errors: validationErrors } = validateLoginForm(formData);
    setErrors(validationErrors);

    if (!isValid) {
      setFormErrorAlert('Please correct the highlighted errors before submitting.');
      return;
    }

    setFormErrorAlert(null);
    setIsSubmitting(true);

    try {
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = result.data || {};

      if (!result.ok || !data.success) {
        setFormErrorAlert(data.message || 'Invalid email or password.');
        setIsSubmitting(false);
        return;
      }

      // 1. Authenticate via React AuthContext (updates state and codeforge_auth storage)
      login(data.token, data.user);
      setLoggedInUser(data.user);
      setIsSubmitting(false);
      setIsSubmitted(true);

      // 2. Redirect user to intended protected route or default /dashboard
      const targetPath = location.state?.from?.pathname || '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (err) {
      console.error('Login network error:', err);
      setFormErrorAlert('Unable to connect to backend server. Please verify network connectivity and try again.');
      setIsSubmitting(false);
    }
  };

  // Reset form handler
  const handleReset = () => {
    setFormData({ email: '', password: '' });
    setTouched({ email: false, password: false });
    setErrors({});
    setFormErrorAlert(null);
    setIsSubmitted(false);
    setIsSubmitting(false);
    setLoggedInUser(null);
    setShowPassword(false);
  };

  // Helper for Bootstrap validation class
  const getValidationClass = (fieldName) => {
    if (!touched[fieldName]) return '';
    return errors[fieldName] ? 'is-invalid' : 'is-valid';
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6 col-xl-5">
          {/* Navigation back to Home */}
          <div className="mb-3">
            <Link to="/" className="text-secondary small text-decoration-none d-inline-flex align-items-center gap-1">
              &larr; Back to Home
            </Link>
          </div>

          {isSubmitted ? (
            /* ============================================================ */
            /* SUCCESS STATE (AUTHENTICATED VIA MONGODB)                    */
            /* ============================================================ */
            <div className="card shadow-sm border-0 text-center p-4 p-md-5">
              <div className="card-body">
                <div
                  className="rounded-circle bg-success text-white d-inline-flex align-items-center justify-content-center mb-4"
                  style={{ width: '70px', height: '70px', fontSize: '2rem' }}
                  aria-hidden="true"
                >
                  ✓
                </div>

                <h2 className="card-title fw-bold text-dark mb-2">
                  Welcome back, {loggedInUser?.fullName || 'Programmer'}!
                </h2>
                <p className="lead text-secondary mb-3">
                  You have signed in successfully.
                </p>

                <div className="alert alert-success py-3 px-4 text-start small my-4" role="alert">
                  <strong className="d-block mb-1">Authenticated via MongoDB:</strong>
                  <span className="text-muted d-block mb-1">
                    Account: <strong>{loggedInUser?.fullName}</strong> ({loggedInUser?.email})
                  </span>
                  <span className="text-muted d-block mb-1">
                    Experience: <strong>{loggedInUser?.experience}</strong>
                  </span>
                  <span className="text-muted d-block">
                    Interests: <strong>{loggedInUser?.interests?.join(', ')}</strong>
                  </span>
                  <hr className="my-2" />
                  <span className="text-success fw-semibold d-block">
                    ✓ Session stored locally; user profile and dashboard personalized.
                  </span>
                </div>

                <div className="d-flex flex-column gap-2">
                  <Link to="/dashboard" className="btn btn-primary py-2 fw-semibold">
                    Go to Dashboard &rarr;
                  </Link>
                  <Link to="/practice" className="btn btn-outline-primary py-2">
                    Start Practicing
                  </Link>
                  <button
                    type="button"
                    className="btn btn-link text-secondary text-decoration-none small mt-2"
                    onClick={handleReset}
                  >
                    Sign in with another account
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* LOGIN FORM CARD                                              */
            /* ============================================================ */
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                {/* Brand & Header */}
                <div className="text-center mb-4">
                  <h5 className="fw-bold text-dark mb-1">
                    <span className="text-dark">Code</span>
                    <span className="text-primary">Forge</span>
                  </h5>
                  <h1 className="h3 fw-bold text-dark mb-2">Sign In</h1>
                  <p className="text-secondary small mb-0">
                    Welcome back! Enter your credentials to access your account.
                  </p>
                </div>

                {/* Form-Level Error Alert */}
                {formErrorAlert && (
                  <div className="alert alert-danger py-2 px-3 small mb-4 d-flex align-items-center gap-2" role="alert">
                    <span className="fw-bold" aria-hidden="true">✕</span>
                    <span>{formErrorAlert}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* FIELD 1: EMAIL ADDRESS */}
                  <div className="mb-3">
                    <label htmlFor="loginEmail" className="form-label fw-semibold small">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className={`form-control ${getValidationClass('email')}`}
                      id="loginEmail"
                      name="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={!!errors.email}
                      autoComplete="email"
                    />
                    <div className="valid-feedback">Email address looks good.</div>
                    <div className="invalid-feedback">{errors.email}</div>
                  </div>

                  {/* FIELD 2: PASSWORD WITH SHOW/HIDE TOGGLE */}
                  <div className="mb-4">
                    <label htmlFor="loginPassword" className="form-label fw-semibold small">
                      Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group has-validation">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`form-control ${getValidationClass('password')}`}
                        id="loginPassword"
                        name="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        aria-required="true"
                        aria-invalid={!!errors.password}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                      <div className="valid-feedback">Password looks good.</div>
                      <div className="invalid-feedback">{errors.password}</div>
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <div className="d-grid mb-4">
                    <button
                      type="submit"
                      className="btn btn-primary py-2 fw-semibold shadow-sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Signing In...' : 'Login'}
                    </button>
                  </div>

                  {/* SECONDARY NAVIGATION: SIGN UP */}
                  <div className="text-center">
                    <p className="text-secondary small mb-0">
                      Don't have an account?{' '}
                      <Link to="/register" className="text-primary fw-semibold text-decoration-none">
                        Sign Up
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
