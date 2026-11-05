import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// COURSE SYLLABUS REQUIREMENT: Isolated jQuery interaction.
// Used exclusively for transient micro-interactions (animations, focus aids, and transition effects),
// ensuring React maintains exclusive control over state management and DOM rendering.
import $ from 'jquery';
import { apiFetch } from '../utils/api';

import {
  validateName,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateGender,
  validateExperience,
  validateInterests,
  validateTerms,
  calculatePasswordStrength,
  validateRegistrationForm
} from '../utils/validation';

/**
 * Registration Page Component
 * Demonstrates complete client-side form validation, Bootstrap feedback styling,
 * radio buttons, select dropdown, multi-checkboxes, password strength calculation,
 * and isolated jQuery visual micro-interactions.
 */
export default function Register() {
  // Initial empty form state
  const initialFormState = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: '',
    experience: '',
    interests: [],
    terms: false
  };

  const [formData, setFormData] = useState(initialFormState);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrorAlert, setFormErrorAlert] = useState(null);

  // Available options
  const genderOptions = ['Male', 'Female', 'Other'];
  const experienceOptions = ['Beginner', 'Intermediate', 'Advanced'];
  const interestOptions = [
    'Data Structures & Algorithms',
    'Web Development',
    'Artificial Intelligence',
    'Cybersecurity',
    'Database Development'
  ];

  // Dynamic password strength computation
  const passwordStrength = calculatePasswordStrength(formData.password);

  // Validate a single field
  const validateField = (fieldName, value, allValues = formData) => {
    switch (fieldName) {
      case 'fullName':
        return validateName(value);
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'confirmPassword':
        return validateConfirmPassword(value, allValues.password);
      case 'gender':
        return validateGender(value);
      case 'experience':
        return validateExperience(value);
      case 'interests':
        return validateInterests(value);
      case 'terms':
        return validateTerms(value);
      default:
        return { isValid: true };
    }
  };

  // Change handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => {
      const updated = { ...prev, [name]: fieldValue };

      // If already touched, validate on change for immediate feedback
      if (touched[name]) {
        const validation = validateField(name, fieldValue, updated);
        setErrors((prevErr) => ({
          ...prevErr,
          [name]: validation.isValid ? null : validation.message
        }));
      }

      // Re-validate confirmPassword if password changed and confirm was already touched
      if (name === 'password' && touched.confirmPassword) {
        const confirmValidation = validateConfirmPassword(prev.confirmPassword, fieldValue);
        setErrors((prevErr) => ({
          ...prevErr,
          confirmPassword: confirmValidation.isValid ? null : confirmValidation.message
        }));
      }

      return updated;
    });
  };

  const handleInterestToggle = (interest) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(interest);
      const newInterests = exists
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];

      if (touched.interests) {
        const validation = validateInterests(newInterests);
        setErrors((prevErr) => ({
          ...prevErr,
          interests: validation.isValid ? null : validation.message
        }));
      }

      return { ...prev, interests: newInterests };
    });
  };

  // Blur handler to mark field as touched and trigger validation
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    const validation = validateField(name, formData[name]);
    setErrors((prev) => ({
      ...prev,
      [name]: validation.isValid ? null : validation.message
    }));
  };

  // Explicit blur for checkboxes group
  const handleInterestsBlur = () => {
    setTouched((prev) => ({ ...prev, interests: true }));
    const validation = validateInterests(formData.interests);
    setErrors((prev) => ({
      ...prev,
      interests: validation.isValid ? null : validation.message
    }));
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched = Object.keys(initialFormState).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);

    // Run complete client-side validation
    const { isValid, errors: validationErrors } = validateRegistrationForm(formData);
    setErrors(validationErrors);

    if (!isValid) {
      setFormErrorAlert('Please correct the highlighted errors before submitting.');
      // Isolated jQuery interaction: animate the alert to draw user focus
      $('#form-error-alert')
        .stop(true, true)
        .css({ opacity: 0 })
        .animate({ opacity: 1 }, 200);
      return;
    }

    setFormErrorAlert(null);
    setIsSubmitting(true);

    try {
      const result = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          gender: formData.gender,
          experience: formData.experience,
          interests: formData.interests
        })
      });

      if (!result.ok || !result.data?.success) {
        if (result.data?.errors && typeof result.data.errors === 'object') {
          setErrors((prevErr) => ({ ...prevErr, ...result.data.errors }));
        }
        setFormErrorAlert(result.data?.message || 'Registration failed. Please try again.');
        setIsSubmitting(false);
        setTimeout(() => {
          $('#form-error-alert')
            .stop(true, true)
            .css({ opacity: 0 })
            .animate({ opacity: 1 }, 200);
        }, 50);
        return;
      }

      // Successful registration in MongoDB
      setIsSubmitting(false);
      setIsSubmitted(true);

      // Isolated jQuery interaction: smooth fade-in for the success container
      setTimeout(() => {
        $('#registration-success-card')
          .stop(true, true)
          .css({ opacity: 0 })
          .animate({ opacity: 1 }, 300);
      }, 50);
    } catch (err) {
      console.error('Registration network error:', err);
      setFormErrorAlert('Unable to connect to backend server. Please verify the backend is running.');
      setIsSubmitting(false);
      setTimeout(() => {
        $('#form-error-alert')
          .stop(true, true)
          .css({ opacity: 0 })
          .animate({ opacity: 1 }, 200);
      }, 50);
    }
  };

  // Reset form handler
  const handleReset = () => {
    setFormData(initialFormState);
    setTouched({});
    setErrors({});
    setIsSubmitted(false);
    setIsSubmitting(false);
    setFormErrorAlert(null);
  };

  // Helper to determine field validation status class
  const getValidationClass = (fieldName) => {
    if (!touched[fieldName]) return '';
    return errors[fieldName] ? 'is-invalid' : 'is-valid';
  };

  // Isolated jQuery effect: Highlight password helper on password focus
  useEffect(() => {
    const $pwd = $('#password');
    const $help = $('#password-requirements-box');

    $pwd.on('focus', function () {
      $help.stop(true, true).slideDown(150);
    });

    return () => {
      $pwd.off('focus');
    };
  }, []);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8 col-xl-7">
          {isSubmitted ? (
            /* ============================================================ */
            /* SUCCESS STATE (MONGODB INTEGRATED CONFIRMATION)              */
            /* ============================================================ */
            <div
              id="registration-success-card"
              className="card shadow-sm border-0 text-center p-4 p-md-5"
            >
              <div className="card-body">
                <div
                  className="rounded-circle bg-success text-white d-inline-flex align-items-center justify-content-center mb-4"
                  style={{ width: '70px', height: '70px', fontSize: '2rem' }}
                  aria-hidden="true"
                >
                  ✓
                </div>

                <h2 className="card-title fw-bold text-dark mb-2">
                  Account Created Successfully!
                </h2>
                <p className="lead text-secondary mb-4">
                  Your CodeForge account has been registered and securely stored in MongoDB.
                </p>

                <div className="alert alert-info py-3 px-4 text-start small mb-4">
                  <h6 className="fw-bold mb-1">Registration Summary:</h6>
                  <ul className="mb-0 ps-3">
                    <li><strong>Name:</strong> {formData.fullName}</li>
                    <li><strong>Email:</strong> {formData.email}</li>
                    <li><strong>Experience:</strong> {formData.experience}</li>
                    <li><strong>Interests:</strong> {formData.interests.join(', ')}</li>
                  </ul>
                  <hr className="my-2" />
                  <p className="mb-0 text-success fw-semibold">
                    ✓ Stored in MongoDB (mongodb://127.0.0.1:27017/codeforge) with bcrypt password hashing.
                  </p>
                </div>

                <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
                  <Link to="/login" className="btn btn-primary px-4 py-2 fw-semibold">
                    Continue to Login &rarr;
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 py-2"
                    onClick={handleReset}
                  >
                    Register Another Account
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* REGISTRATION FORM CARD                                       */
            /* ============================================================ */
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                {/* Brand & Header */}
                <div className="text-center mb-4">
                  <h5 className="fw-bold text-dark mb-1">
                    <span className="text-dark">Code</span>
                    <span className="text-primary">Forge</span>
                  </h5>
                  <h1 className="h3 fw-bold text-dark mb-2">Create an Account</h1>
                  <p className="text-secondary small mb-0">
                    Practice coding problems, build algorithmic intuition, and track your skills.
                  </p>
                </div>

                {/* Form-level Error Alert */}
                {formErrorAlert && (
                  <div
                    id="form-error-alert"
                    className="alert alert-danger py-2 px-3 small mb-4 d-flex align-items-center gap-2"
                    role="alert"
                  >
                    <span className="fw-bold" aria-hidden="true">✕</span>
                    <span>{formErrorAlert}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* FIELD 1: FULL NAME */}
                  <div className="mb-3">
                    <label htmlFor="fullName" className="form-label fw-semibold small">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${getValidationClass('fullName')}`}
                      id="fullName"
                      name="fullName"
                      autoComplete="name"
                      placeholder="e.g. Alan Turing"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={touched.fullName ? !!errors.fullName : undefined}
                      aria-describedby={touched.fullName && errors.fullName ? 'fullName-error' : undefined}
                    />
                    <div className="valid-feedback">✓ Looks good!</div>
                    <div id="fullName-error" className="invalid-feedback">{errors.fullName}</div>
                  </div>

                  {/* FIELD 2: EMAIL */}
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label fw-semibold small">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className={`form-control ${getValidationClass('email')}`}
                      id="email"
                      name="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={touched.email ? !!errors.email : undefined}
                      aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                    />
                    <div className="valid-feedback">✓ Email address looks good.</div>
                    <div id="email-error" className="invalid-feedback">{errors.email}</div>
                  </div>

                  {/* FIELD 3: PASSWORD */}
                  <div className="mb-3">
                    <label htmlFor="password" className="form-label fw-semibold small">
                      Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      className={`form-control ${getValidationClass('password')}`}
                      id="password"
                      name="password"
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={touched.password ? !!errors.password : undefined}
                      aria-describedby={touched.password && errors.password ? 'password-error password-help' : 'password-help'}
                    />
                    <div className="valid-feedback">✓ Password meets security requirements.</div>
                    <div id="password-error" className="invalid-feedback">{errors.password}</div>

                    {/* Requirements Note */}
                    <div id="password-help" className="form-text small text-muted mt-1">
                      Must be at least 8 characters and contain at least one letter and one number.
                    </div>

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2" id="password-strength-container">
                        <div className="d-flex justify-content-between align-items-center small mb-1">
                          <span className="text-secondary">Password strength:</span>
                          <span className={`fw-bold text-${passwordStrength.color}`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                          <div
                            className={`progress-bar bg-${passwordStrength.color}`}
                            role="progressbar"
                            style={{ width: `${passwordStrength.percentage}%` }}
                            aria-valuenow={passwordStrength.percentage}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FIELD 4: CONFIRM PASSWORD */}
                  <div className="mb-4">
                    <label htmlFor="confirmPassword" className="form-label fw-semibold small">
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      className={`form-control ${getValidationClass('confirmPassword')}`}
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={touched.confirmPassword ? !!errors.confirmPassword : undefined}
                      aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                    />
                    <div className="valid-feedback">✓ Passwords match.</div>
                    <div id="confirmPassword-error" className="invalid-feedback">{errors.confirmPassword}</div>
                  </div>

                  {/* FIELD 5: GENDER RADIO BUTTONS */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold small d-block">
                      Gender <span className="text-danger">*</span>
                    </label>
                    <div
                      className="d-flex gap-4"
                      role="radiogroup"
                      aria-required="true"
                      aria-invalid={touched.gender ? !!errors.gender : undefined}
                      aria-describedby={touched.gender && errors.gender ? 'gender-error' : undefined}
                    >
                      {genderOptions.map((option) => (
                        <div key={option} className="form-check">
                          <input
                            className={`form-check-input ${
                              touched.gender && errors.gender ? 'is-invalid' : ''
                            }`}
                            type="radio"
                            name="gender"
                            id={`gender-${option}`}
                            value={option}
                            checked={formData.gender === option}
                            onChange={handleInputChange}
                            onBlur={handleBlur}
                          />
                          <label className="form-check-label small" htmlFor={`gender-${option}`}>
                            {option}
                          </label>
                        </div>
                      ))}
                    </div>
                    {touched.gender && errors.gender && (
                      <div id="gender-error" className="invalid-feedback d-block small mt-1">{errors.gender}</div>
                    )}
                    {touched.gender && !errors.gender && (
                      <div className="valid-feedback d-block small mt-1">✓ Gender selected.</div>
                    )}
                  </div>

                  {/* FIELD 6: PROGRAMMING EXPERIENCE DROPDOWN */}
                  <div className="mb-4">
                    <label htmlFor="experience" className="form-label fw-semibold small">
                      Programming Experience <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select ${getValidationClass('experience')}`}
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleInputChange}
                      onBlur={handleBlur}
                      aria-required="true"
                      aria-invalid={touched.experience ? !!errors.experience : undefined}
                      aria-describedby={touched.experience && errors.experience ? 'experience-error' : undefined}
                    >
                      <option value="">Select experience</option>
                      {experienceOptions.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp}
                        </option>
                      ))}
                    </select>
                    <div className="valid-feedback">✓ Experience level selected.</div>
                    <div id="experience-error" className="invalid-feedback">{errors.experience}</div>
                  </div>

                  {/* FIELD 7: PROGRAMMING INTERESTS CHECKBOXES */}
                  <div
                    className="mb-4"
                    onBlur={handleInterestsBlur}
                    aria-invalid={touched.interests ? !!errors.interests : undefined}
                    aria-describedby={touched.interests && errors.interests ? 'interests-error' : undefined}
                  >
                    <label className="form-label fw-semibold small d-block mb-1">
                      Programming Interests <span className="text-danger">*</span>
                    </label>
                    <small className="text-muted d-block mb-2">
                      Select at least one area of interest.
                    </small>
                    <div className="d-flex flex-column gap-2 ps-1">
                      {interestOptions.map((interest) => {
                        const isChecked = formData.interests.includes(interest);
                        return (
                          <div key={interest} className="form-check">
                            <input
                              className={`form-check-input ${
                                touched.interests && errors.interests ? 'is-invalid' : ''
                              }`}
                              type="checkbox"
                              id={`interest-${interest.replace(/\s+/g, '-').toLowerCase()}`}
                              checked={isChecked}
                              onChange={() => handleInterestToggle(interest)}
                            />
                            <label
                              className="form-check-label small"
                              htmlFor={`interest-${interest.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                              {interest}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {touched.interests && errors.interests && (
                      <div id="interests-error" className="invalid-feedback d-block small mt-1">{errors.interests}</div>
                    )}
                    {touched.interests && !errors.interests && (
                      <div className="valid-feedback d-block small mt-1">
                        ✓ {formData.interests.length} interest(s) selected.
                      </div>
                    )}
                  </div>

                  {/* FIELD 8: TERMS AND CONDITIONS CHECKBOX */}
                  <div className="mb-4">
                    <div className="form-check">
                      <input
                        className={`form-check-input ${
                          touched.terms && errors.terms ? 'is-invalid' : ''
                        }`}
                        type="checkbox"
                        id="terms"
                        name="terms"
                        checked={formData.terms}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        aria-required="true"
                        aria-invalid={touched.terms ? !!errors.terms : undefined}
                        aria-describedby={touched.terms && errors.terms ? 'terms-error' : undefined}
                      />
                      <label className="form-check-label small" htmlFor="terms">
                        I agree to the CodeForge Terms and Conditions. <span className="text-danger">*</span>
                      </label>
                      <div id="terms-error" className="invalid-feedback">{errors.terms}</div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS: SUBMIT AND RESET */}
                  <div className="d-flex flex-column gap-2 pt-2 border-top">
                    <button
                      id="btn-register-submit"
                      type="submit"
                      className="btn btn-primary py-2 fw-semibold shadow-sm"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </button>
                    <button
                      id="btn-register-reset"
                      type="button"
                      className="btn btn-outline-secondary py-2 small"
                      onClick={handleReset}
                    >
                      Reset Form
                    </button>
                  </div>

                  {/* NAVIGATION TO LOGIN */}
                  <div className="text-center mt-4 pt-2">
                    <p className="text-secondary small mb-0">
                      Already have an account?{' '}
                      <Link to="/login" className="text-primary fw-semibold text-decoration-none">
                        Login
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
