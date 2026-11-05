import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { defaultProfile } from '../utils/profile';
import { useAuth } from '../context/useAuth';
import { getUserProfile, updateUserProfile, deleteUserAccount } from '../utils/api';
import Icon from '../components/Icons';
import {
  GOAL_MAP,
  LANGUAGE_MAP,
  LANGUAGE_STATUS_MAP,
  STARTING_MODE_MAP
} from '../utils/learningPlan';

/**
 * Profile Page Component
 * Displays authenticated user profile information (fullName, email, gender, experience, interests)
 * backed directly by MongoDB APIs (GET /api/users/me and PUT /api/users/me),
 * with interactive editing, real radio buttons/select/checkboxes, and AuthContext synchronization.
 */
export default function Profile() {
  const { user: authUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => ({
    ...defaultProfile,
    fullName: authUser?.fullName || defaultProfile.fullName,
    email: authUser?.email || defaultProfile.email,
    gender: authUser?.gender || 'Not specified',
    experience: authUser?.experience || defaultProfile.experience,
    interests: authUser?.interests || defaultProfile.interests,
    createdAt: null,
    updatedAt: null,
    onboardingCompleted: authUser?.onboardingCompleted || false,
    learningGoals: authUser?.learningGoals || [],
    languages: authUser?.languages || [],
    preferredStartingMode: authUser?.preferredStartingMode || 'diagnostic',
    selectedTopics: authUser?.selectedTopics || []
  }));

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    gender: 'Other',
    experience: 'Beginner',
    interests: []
  });

  const [touched, setTouched] = useState({
    fullName: false,
    gender: false,
    experience: false,
    interests: false
  });

  const [errors, setErrors] = useState({
    fullName: '',
    gender: '',
    experience: '',
    interests: ''
  });

  const [successAlert, setSuccessAlert] = useState(null);
  const [errorAlert, setErrorAlert] = useState(null);

  // Account Deletion State (Part A)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

  const isProtectedAccount =
    profile.role === 'admin' ||
    authUser?.role === 'admin' ||
    profile.id === '6ad0d0523e11bbee9b5c984c' ||
    authUser?.id === '6ad0d0523e11bbee9b5c984c' ||
    (profile.email && profile.email.toLowerCase().includes('faculty.audit'));

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE MY ACCOUNT' || !deletePassword) {
      setDeleteError('Please enter your password and type "DELETE MY ACCOUNT" to confirm.');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteUserAccount({
        password: deletePassword,
        confirmation: deleteConfirmation.trim()
      });
      if (res.ok && res.data?.success) {
        setDeleteSuccess('Account successfully deleted. Logging out...');
        setTimeout(() => {
          logout();
          navigate('/login', {
            state: { info: 'Your account and personal learning data have been permanently deleted.' }
          });
        }, 750);
      } else {
        setDeleteError(res.data?.message || 'Unable to delete account. Please verify your password.');
        setIsDeleting(false);
      }
    } catch (err) {
      setDeleteError(err.message || 'An unexpected network error occurred.');
      setIsDeleting(false);
    }
  };

  const availableGenders = ['Male', 'Female', 'Other'];
  const availableExperience = ['Beginner', 'Intermediate', 'Advanced'];
  const allInterestOptions = [
    'Data Structures & Algorithms',
    'Web Development',
    'Artificial Intelligence',
    'Cybersecurity',
    'Database Development'
  ];

  // Validation functions
  const validateFullName = (val) => {
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      return 'Full name is required.';
    }
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      return 'Full name must be at least 2 characters.';
    }
    if (trimmed.length > 50) {
      return 'Full name must be 50 characters or less.';
    }
    return '';
  };

  const validateGender = (val) => {
    if (!val || !availableGenders.includes(val)) {
      return 'Please select a gender option.';
    }
    return '';
  };

  const validateExperience = (val) => {
    if (!val || !availableExperience.includes(val)) {
      return 'Please select a valid experience level.';
    }
    return '';
  };

  const validateInterests = (val) => {
    if (!Array.isArray(val) || val.length === 0) {
      return 'Please select at least one programming interest.';
    }
    const invalid = val.find((item) => !allInterestOptions.includes(item));
    if (invalid) {
      return `Invalid interest selection: "${invalid}".`;
    }
    return '';
  };

  const runFieldValidation = (field, value) => {
    let err = '';
    if (field === 'fullName') err = validateFullName(value);
    else if (field === 'gender') err = validateGender(value);
    else if (field === 'experience') err = validateExperience(value);
    else if (field === 'interests') err = validateInterests(value);

    setErrors((prev) => ({ ...prev, [field]: err }));
    return err;
  };

  useEffect(() => {
    let isMounted = true;

    getUserProfile().then((res) => {
      if (!isMounted) return;
      if (res.ok && res.data && res.data.success && res.data.user) {
        const u = res.data.user;
        setProfile((prev) => ({
          ...prev,
          ...u,
          skills: prev.skills || defaultProfile.skills
        }));
        if (updateUser) {
          updateUser(u);
        }
      } else {
        setLoadError(res.data?.message || 'Unable to load profile. Please try again.');
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [updateUser]);

  const handleRetry = () => {
    setIsLoading(true);
    setLoadError(null);
    getUserProfile().then((res) => {
      if (res.ok && res.data && res.data.success && res.data.user) {
        const u = res.data.user;
        setProfile((prev) => ({
          ...prev,
          ...u,
          skills: prev.skills || defaultProfile.skills
        }));
        if (updateUser) {
          updateUser(u);
        }
      } else {
        setLoadError(res.data?.message || 'Unable to load profile. Please try again.');
      }
      setIsLoading(false);
    });
  };

  // Enter edit mode
  const handleStartEdit = () => {
    setEditFormData({
      fullName: profile.fullName || '',
      email: profile.email || '',
      gender: availableGenders.includes(profile.gender) ? profile.gender : 'Other',
      experience: availableExperience.includes(profile.experience) ? profile.experience : 'Beginner',
      interests: Array.isArray(profile.interests) ? [...profile.interests] : []
    });
    setTouched({
      fullName: false,
      gender: false,
      experience: false,
      interests: false
    });
    setErrors({
      fullName: '',
      gender: '',
      experience: '',
      interests: ''
    });
    setErrorAlert(null);
    setSuccessAlert(null);
    setIsEditing(true);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditFormData({
      fullName: profile.fullName || '',
      email: profile.email || '',
      gender: profile.gender || '',
      experience: profile.experience || '',
      interests: Array.isArray(profile.interests) ? [...profile.interests] : []
    });
    setTouched({
      fullName: false,
      gender: false,
      experience: false,
      interests: false
    });
    setErrors({
      fullName: '',
      gender: '',
      experience: '',
      interests: ''
    });
    setErrorAlert(null);
    setIsEditing(false);
  };

  // Handle text/radio/select change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (touched[name]) {
        runFieldValidation(name, value);
      }
      return next;
    });
  };

  // Handle blur
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    runFieldValidation(field, editFormData[field]);
  };

  // Handle interest checkbox toggling
  const handleInterestToggle = (interest) => {
    setEditFormData((prev) => {
      const exists = prev.interests.includes(interest);
      const updated = exists
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      if (touched.interests) {
        runFieldValidation('interests', updated);
      }
      return { ...prev, interests: updated };
    });
  };

  // Save changes handler -> PUT /api/users/me
  const handleSave = async (e) => {
    e.preventDefault();

    // Mark all as touched
    setTouched({
      fullName: true,
      gender: true,
      experience: true,
      interests: true
    });

    const nameErr = validateFullName(editFormData.fullName);
    const genderErr = validateGender(editFormData.gender);
    const expErr = validateExperience(editFormData.experience);
    const intErr = validateInterests(editFormData.interests);

    setErrors({
      fullName: nameErr,
      gender: genderErr,
      experience: expErr,
      interests: intErr
    });

    if (nameErr || genderErr || expErr || intErr) {
      setErrorAlert('Please correct the validation errors below before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorAlert(null);

    const payload = {
      fullName: editFormData.fullName.trim(),
      gender: editFormData.gender,
      experience: editFormData.experience,
      interests: editFormData.interests
    };

    const res = await updateUserProfile(payload);

    if (res.ok && res.data && res.data.success && res.data.user) {
      const updatedUser = res.data.user;
      setProfile((prev) => ({
        ...prev,
        ...updatedUser
      }));

      if (updateUser) {
        updateUser(updatedUser);
      }

      setIsEditing(false);
      setSuccessAlert('Profile updated successfully.');
      setTimeout(() => setSuccessAlert(null), 5000);
    } else {
      setErrorAlert(res.data?.message || 'Unable to update profile. Please try again.');
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 col-12 col-md-8 col-lg-6 mx-auto">
          <div className="spinner-border text-primary mx-auto mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="fw-bold text-dark">Loading profile...</h4>
          <p className="text-secondary small mb-0">Retrieving your profile from MongoDB</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 col-12 col-md-8 col-lg-6 mx-auto">
          <div className="mb-3 text-danger">
            <Icon name="alert-triangle" size={48} />
          </div>
          <h4 className="fw-bold text-dark mb-2">Unable to Load Profile</h4>
          <p className="text-secondary mb-4">{loadError}</p>
          <button
            type="button"
            className="btn btn-primary px-4 fw-semibold mx-auto"
            onClick={handleRetry}
          >
            Retry Loading Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-9">
          {/* PROFILE HEADER */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4 p-md-5 d-flex flex-column flex-sm-row align-items-center gap-4">
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '84px', height: '84px', fontSize: '2rem', fontWeight: 'bold' }}
                aria-hidden="true"
              >
                {profile.fullName
                  ? profile.fullName
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'CF'}
              </div>

              <div className="flex-grow-1 text-center text-sm-start">
                <div className="d-flex flex-wrap align-items-center justify-content-center justify-content-sm-start gap-2 mb-1">
                  <h1 className="h3 fw-bold text-dark mb-0">{profile.fullName}</h1>
                  <span className="badge bg-success-subtle text-success border border-success-subtle small">
                    MongoDB Authenticated
                  </span>
                </div>
                <p className="text-secondary small mb-2">{profile.email}</p>
                <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-sm-start">
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                    Level: {profile.experience}
                  </span>
                  <span className="badge bg-info-subtle text-dark border border-info-subtle">
                    Gender: {profile.gender || 'Not specified'}
                  </span>
                  <span className="badge bg-light text-muted border">
                    MongoDB Verified
                  </span>
                </div>
              </div>

              {!isEditing && (
                <div className="d-flex flex-column gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3 fw-semibold"
                    onClick={handleStartEdit}
                  >
                    Edit Profile
                  </button>
                  <Link to="/practice" className="btn btn-outline-secondary btn-sm px-3">
                    Practice Problems
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Success Alert */}
          {successAlert && (
            <div className="alert alert-success py-2 px-3 small mb-4 d-flex align-items-center gap-2" role="alert">
              <Icon name="check-circle" size={14} className="flex-shrink-0" />
              <span>{successAlert}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorAlert && (
            <div className="alert alert-danger py-2 px-3 small mb-4 d-flex align-items-center gap-2" role="alert">
              <Icon name="alert-triangle" size={14} className="flex-shrink-0" />
              <span>{errorAlert}</span>
            </div>
          )}

          {isEditing ? (
            /* ============================================================ */
            /* EDIT PROFILE MODE (PERSISTENT MONGODB PUT)                   */
            /* ============================================================ */
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-white border-bottom py-3">
                <h2 className="h5 fw-bold text-dark mb-0">Edit Profile Information</h2>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSave} noValidate>
                  {/* FULL NAME */}
                  <div className="mb-3">
                    <label htmlFor="editFullName" className="form-label fw-semibold small">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${
                        touched.fullName ? (errors.fullName ? 'is-invalid' : 'is-valid') : ''
                      }`}
                      id="editFullName"
                      name="fullName"
                      value={editFormData.fullName}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('fullName')}
                      disabled={isSubmitting}
                      required
                    />
                    {touched.fullName && errors.fullName && (
                      <div className="invalid-feedback">{errors.fullName}</div>
                    )}
                    {touched.fullName && !errors.fullName && (
                      <div className="valid-feedback">Looks good!</div>
                    )}
                  </div>

                  {/* EMAIL (READONLY) */}
                  <div className="mb-3">
                    <label htmlFor="editEmail" className="form-label fw-semibold small">
                      Email Address (Read-only)
                    </label>
                    <input
                      type="email"
                      className="form-control bg-light"
                      id="editEmail"
                      name="email"
                      value={editFormData.email}
                      readOnly
                      disabled
                    />
                    <div className="form-text small text-muted">
                      Email address is linked to your authenticated MongoDB account and cannot be modified.
                    </div>
                  </div>

                  {/* GENDER (RADIO BUTTONS) */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small d-block">
                      Gender <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex flex-wrap gap-4 pt-1">
                      {availableGenders.map((g) => (
                        <div key={g} className="form-check">
                          <input
                            className={`form-check-input ${
                              touched.gender ? (errors.gender ? 'is-invalid' : 'is-valid') : ''
                            }`}
                            type="radio"
                            name="gender"
                            id={`gender-${g}`}
                            value={g}
                            checked={editFormData.gender === g}
                            onChange={handleInputChange}
                            onBlur={() => handleBlur('gender')}
                            disabled={isSubmitting}
                          />
                          <label className="form-check-label small" htmlFor={`gender-${g}`}>
                            {g}
                          </label>
                        </div>
                      ))}
                    </div>
                    {touched.gender && errors.gender && (
                      <div className="invalid-feedback d-block">{errors.gender}</div>
                    )}
                    {touched.gender && !errors.gender && (
                      <div className="valid-feedback d-block">Looks good!</div>
                    )}
                  </div>

                  {/* EXPERIENCE (DROPDOWN/SELECT) */}
                  <div className="mb-4">
                    <label htmlFor="editExperience" className="form-label fw-semibold small">
                      Programming Experience <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select ${
                        touched.experience ? (errors.experience ? 'is-invalid' : 'is-valid') : ''
                      }`}
                      id="editExperience"
                      name="experience"
                      value={editFormData.experience}
                      onChange={handleInputChange}
                      onBlur={() => handleBlur('experience')}
                      disabled={isSubmitting}
                    >
                      <option value="" disabled>Select experience</option>
                      {availableExperience.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp}
                        </option>
                      ))}
                    </select>
                    {touched.experience && errors.experience && (
                      <div className="invalid-feedback">{errors.experience}</div>
                    )}
                    {touched.experience && !errors.experience && (
                      <div className="valid-feedback">Looks good!</div>
                    )}
                  </div>

                  {/* PROGRAMMING INTERESTS (CHECKBOXES) */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold small d-block mb-1">
                      Programming Interests <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex flex-column gap-2 ps-1">
                      {allInterestOptions.map((interest) => {
                        const isChecked = editFormData.interests.includes(interest);
                        return (
                          <div key={interest} className="form-check">
                            <input
                              className={`form-check-input ${
                                touched.interests ? (errors.interests ? 'is-invalid' : 'is-valid') : ''
                              }`}
                              type="checkbox"
                              id={`edit-interest-${interest.replace(/\s+/g, '-').toLowerCase()}`}
                              checked={isChecked}
                              disabled={isSubmitting}
                              onChange={() => handleInterestToggle(interest)}
                              onBlur={() => handleBlur('interests')}
                            />
                            <label
                              className="form-check-label small"
                              htmlFor={`edit-interest-${interest.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                              {interest}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {touched.interests && errors.interests && (
                      <div className="invalid-feedback d-block">{errors.interests}</div>
                    )}
                    {touched.interests && !errors.interests && (
                      <div className="valid-feedback d-block">Looks good!</div>
                    )}
                  </div>

                  {/* BUTTONS */}
                  <div className="d-flex gap-2 pt-2 border-top">
                    <button
                      type="submit"
                      className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      )}
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary px-4"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* PROFILE VIEW DETAILS                                         */
            /* ============================================================ */
            <div className="row g-4">
              {/* Profile Details & Interests */}
              <div className="col-12 col-md-6">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-header bg-white border-bottom py-3">
                    <h2 className="h5 fw-bold text-dark mb-0">Profile Information</h2>
                  </div>
                  <div className="card-body p-4">
                    <div className="mb-3">
                      <span className="text-muted small d-block">Full Name</span>
                      <strong className="text-dark fs-6">{profile.fullName}</strong>
                    </div>

                    <div className="mb-3">
                      <span className="text-muted small d-block">Email Address</span>
                      <strong className="text-dark fs-6">{profile.email}</strong>
                    </div>

                    <div className="mb-3">
                      <span className="text-muted small d-block">Gender</span>
                      <strong className="text-dark fs-6">{profile.gender || 'Not specified'}</strong>
                    </div>

                    <div className="mb-4">
                      <span className="text-muted small d-block">Experience Level</span>
                      <span className="badge bg-primary px-2 py-1 fs-6 mt-1">
                        {profile.experience}
                      </span>
                    </div>

                    <hr />

                    {/* PROGRAMMING INTERESTS */}
                    <div className="mb-3">
                      <h3 className="h6 fw-bold text-dark mb-3">Programming Interests</h3>
                      <div className="d-flex flex-wrap gap-2">
                        {profile.interests && profile.interests.length > 0 ? (
                          profile.interests.map((interest) => (
                            <span
                              key={interest}
                              className="badge bg-light text-dark border py-2 px-3 fw-normal small d-inline-flex align-items-center gap-1"
                            >
                              <span className="text-success fw-bold">✓</span>
                              <span>{interest}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-muted small">No interests selected.</span>
                        )}
                      </div>
                    </div>

                    {/* ACCOUNT INFORMATION */}
                    {(profile.createdAt || profile.updatedAt) && (
                      <>
                        <hr />
                        <div>
                          <h3 className="h6 fw-bold text-dark mb-2">Account Information</h3>
                          {profile.createdAt && (
                            <div className="small text-muted mb-1">
                              Member Since: {new Date(profile.createdAt).toLocaleDateString()}
                            </div>
                          )}
                          {profile.updatedAt && (
                            <div className="small text-muted">
                              Last Updated: {new Date(profile.updatedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* SKILL SUMMARY */}
              <div className="col-12 col-md-6">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                    <h2 className="h5 fw-bold text-dark mb-0">Skill Summary</h2>
                    <span className="badge bg-primary-subtle text-primary small">Competency</span>
                  </div>
                  <div className="card-body p-4">
                    <p className="text-muted small mb-4">
                      Calculated from algorithmic problem assessments and quiz performances.
                    </p>

                    <div className="d-flex flex-column gap-4">
                      {profile.skills && profile.skills.map((skill) => (
                        <div key={skill.name}>
                          <div className="d-flex justify-content-between align-items-center small mb-1">
                            <span className="fw-semibold text-dark">{skill.name}</span>
                            <span className="fw-bold font-monospace text-secondary">
                              {skill.percentage}%
                            </span>
                          </div>
                          <div className="progress" style={{ height: '8px' }}>
                            <div
                              className={`progress-bar bg-${skill.color}`}
                              role="progressbar"
                              style={{ width: `${skill.percentage}%` }}
                              aria-valuenow={skill.percentage}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-light rounded-3 border small mt-4">
                      <div className="d-flex gap-2">
                        <span className="text-info">ℹ</span>
                        <span className="text-secondary">
                          All user profile attributes are securely stored in MongoDB and synchronized with your active session.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LEARNING PREFERENCES & ADAPTIVE ROADMAP */}
              <div className="card shadow-sm border-0 mt-4">
                <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <Icon name="target" size={20} className="text-primary" />
                    <div>
                      <h2 className="h5 fw-bold text-dark mb-0">Learning Preferences &amp; Goals</h2>
                      <small className="text-muted">Adaptive roadmap configuration and focus targets</small>
                    </div>
                  </div>
                  <Link
                    to={profile.onboardingCompleted ? '/onboarding?edit=true' : '/onboarding'}
                    className="btn btn-outline-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1.5"
                  >
                    <span>{profile.onboardingCompleted ? 'Edit Preferences' : 'Configure Preferences'}</span>
                    <Icon name={profile.onboardingCompleted ? 'gear' : 'arrow-right'} size={14} />
                  </Link>
                </div>
                <div className="card-body p-4">
                  {profile.onboardingCompleted ? (
                    <div className="row g-4">
                      {/* Goals & Mode */}
                      <div className="col-12 col-md-6">
                        <div className="mb-3">
                          <span className="text-muted small d-block mb-1">Learning Goals</span>
                          <div className="d-flex flex-wrap gap-2">
                            {profile.learningGoals && profile.learningGoals.length > 0 ? (
                              profile.learningGoals.map((g) => {
                                const cfg = GOAL_MAP[g] || { badge: g, badgeColor: 'secondary', icon: '•' };
                                return (
                                  <span
                                    key={g}
                                    className={`badge bg-${cfg.badgeColor}-subtle text-${cfg.badgeColor} border border-${cfg.badgeColor}-subtle px-3 py-2 fw-medium`}
                                  >
                                    {cfg.icon} {cfg.badge}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-muted small">No specific goals set</span>
                            )}
                          </div>
                        </div>

                        <div className="mb-3">
                          <span className="text-muted small d-block mb-1">Preferred Starting Mode</span>
                          <span className="badge bg-dark-subtle text-dark border px-3 py-2 fw-medium">
                            {STARTING_MODE_MAP[profile.preferredStartingMode]?.label || 'Diagnostic Assessment'}
                          </span>
                          <p className="text-secondary small mt-1 mb-0">
                            {STARTING_MODE_MAP[profile.preferredStartingMode]?.description || ''}
                          </p>
                        </div>
                      </div>

                      {/* Languages & Focus Topics */}
                      <div className="col-12 col-md-6">
                        <div className="mb-3">
                          <span className="text-muted small d-block mb-1">Focus Languages &amp; Familiarity</span>
                          <div className="d-flex flex-wrap gap-2">
                            {profile.languages && profile.languages.length > 0 ? (
                              profile.languages.map((l) => {
                                const lCfg = LANGUAGE_MAP[l.language] || { name: l.language, icon: l.language };
                                const sCfg = LANGUAGE_STATUS_MAP[l.status] || { label: l.status, badgeColor: 'secondary' };
                                return (
                                  <div
                                    key={l.language}
                                    className="badge bg-light text-dark border px-3 py-2 d-inline-flex align-items-center gap-2"
                                  >
                                    <span className="fw-bold font-monospace text-primary">{lCfg.icon}</span>
                                    <span>{lCfg.name}</span>
                                    <span className={`badge bg-${sCfg.badgeColor} text-white ms-1`}>{sCfg.label}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-muted small">No languages configured</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted small d-block mb-1">Curated Topics</span>
                          <div className="d-flex flex-wrap gap-1">
                            {profile.selectedTopics && profile.selectedTopics.length > 0 ? (
                              profile.selectedTopics.map((top) => (
                                <span key={top} className="badge bg-light text-secondary border px-2.5 py-1 small fw-normal">
                                  {top}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted small">All topics included</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 p-3 bg-light rounded-3 border">
                      <div>
                        <h3 className="h6 fw-bold text-dark mb-1">You haven't set up your learning preferences yet</h3>
                        <p className="text-secondary small mb-0">
                          Tell CodeForge whether you are reviving a past language, learning from scratch, or preparing for interviews to receive tailored starting recommendations.
                        </p>
                      </div>
                      <Link to="/onboarding" className="btn btn-primary btn-sm fw-semibold text-nowrap flex-shrink-0">
                        Get Started →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* ACCOUNT MANAGEMENT & DANGER ZONE (PART A) */}
              <div className="card shadow-sm border border-danger-subtle mt-4">
                <div className="card-header bg-danger-subtle bg-opacity-25 border-bottom border-danger-subtle py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <Icon name="shield" size={20} className="text-danger" />
                    <div>
                      <h2 className="h5 fw-bold text-danger mb-0">Account Management</h2>
                      <small className="text-muted">Account lifecycle, data privacy &amp; irreversible actions</small>
                    </div>
                  </div>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 small fw-semibold">
                    Danger Zone
                  </span>
                </div>
                <div className="card-body p-4">
                  {isProtectedAccount ? (
                    <div className="alert alert-secondary d-flex align-items-start gap-3 mb-0" role="status">
                      <Icon name="shield" size={22} className="text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="h6 fw-bold mb-1 text-dark">Protected Account Safeguard</h3>
                        <p className="small text-secondary mb-0">
                          {profile.role === 'admin'
                            ? 'This account possesses administrator privileges and cannot be deleted through self-service account management. Please contact platform governance.'
                            : 'This account is designated as the Faculty Demo Auditor and is protected from self-service deletion to ensure platform demonstration reliability.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                      <div>
                        <h3 className="h6 fw-bold text-dark mb-1">Delete Account &amp; Personal Data</h3>
                        <p className="text-secondary small mb-0" style={{ maxWidth: '640px' }}>
                          Permanently delete your CodeForge account, credentials, and all recorded learning data—including practice problem submissions, code runs, quiz attempts, diagnostic assessments, and personalized revision roadmaps. This action is irreversible.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm fw-semibold text-nowrap d-inline-flex align-items-center gap-1.5 flex-shrink-0"
                        onClick={() => {
                          setShowDeleteModal(true);
                          setDeletePassword('');
                          setDeleteConfirmation('');
                          setDeleteError(null);
                          setDeleteSuccess(null);
                        }}
                      >
                        <Icon name="trash" size={14} />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACCOUNT DELETION CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div
          className="modal-backdrop-custom d-flex align-items-center justify-content-center p-3"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 1060,
            backdropFilter: 'blur(3px)'
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteAccountModalTitle"
        >
          <div
            className="card border-0 shadow-lg"
            style={{ maxWidth: '540px', width: '100%', borderRadius: '12px' }}
          >
            <div className="card-header bg-danger text-white py-3 px-4 d-flex align-items-center justify-content-between rounded-top-3">
              <div className="d-flex align-items-center gap-2">
                <Icon name="alert-triangle" size={20} color="#fff" />
                <h3 className="h5 fw-bold mb-0 text-white" id="deleteAccountModalTitle">
                  Delete Account &amp; Data
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-light border-0 p-1"
                onClick={() => {
                  if (!isDeleting) {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} color="#fff" />
              </button>
            </div>

            <form onSubmit={handleDeleteAccountSubmit}>
              <div className="card-body p-4">
                <div className="alert alert-danger-subtle border border-danger-subtle text-danger p-3 rounded-3 small mb-3">
                  <div className="fw-bold mb-1">Warning: This action is permanent and cannot be undone.</div>
                  <div>The following personal records will be immediately erased:</div>
                  <ul className="mb-0 ps-3 mt-1">
                    <li>Your account credentials, name, and profile settings</li>
                    <li>All code submissions, runtime stdout, and test results</li>
                    <li>All quiz attempts, scores, and review snapshots</li>
                    <li>All diagnostic assessments and skill baseline evaluations</li>
                    <li>Your personalized revision roadmap and learning goals</li>
                  </ul>
                </div>

                {deleteError && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3" role="alert">
                    <Icon name="alert-triangle" size={15} className="flex-shrink-0" />
                    <div>{deleteError}</div>
                  </div>
                )}

                {deleteSuccess && (
                  <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3" role="alert">
                    <Icon name="check-circle" size={15} className="flex-shrink-0" />
                    <div>{deleteSuccess}</div>
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="delete-account-password" className="form-label fw-semibold small text-dark">
                    Verify Your Password <span className="text-danger">*</span>
                  </label>
                  <input
                    id="delete-account-password"
                    type="password"
                    className="form-control"
                    placeholder="Enter your current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={isDeleting}
                    required
                    autoComplete="current-password"
                  />
                  <div className="form-text small">Re-authentication is required to verify account ownership.</div>
                </div>

                <div className="mb-3">
                  <label htmlFor="delete-account-confirm" className="form-label fw-semibold small text-dark">
                    Type <span className="text-danger font-monospace">DELETE MY ACCOUNT</span> to confirm <span className="text-danger">*</span>
                  </label>
                  <input
                    id="delete-account-confirm"
                    type="text"
                    className="form-control font-monospace"
                    placeholder="DELETE MY ACCOUNT"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    disabled={isDeleting}
                    required
                  />
                  <div className="form-text small">Explicit confirmation prevents accidental deletion.</div>
                </div>
              </div>

              <div className="card-footer bg-light px-4 py-3 d-flex justify-content-end gap-2 border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm fw-semibold"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm fw-semibold d-inline-flex align-items-center gap-1.5"
                  disabled={
                    isDeleting ||
                    deleteConfirmation.trim().toUpperCase() !== 'DELETE MY ACCOUNT' ||
                    !deletePassword
                  }
                >
                  {isDeleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>Permanently Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="trash" size={14} color="#fff" />
                      <span>Permanently Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
