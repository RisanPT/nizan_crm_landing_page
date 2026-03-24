import { useEffect, useMemo, useState } from 'react';
import nizanLogo from '../../nizan_crm/assets/images/nizan_logo.png';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  `${window.location.protocol}//${window.location.hostname}:5001/api`;

const initialForm = {
  customerName: '',
  phone: '',
  email: '',
  regionId: '',
  packageId: '',
  selectedDate: '',
};

function App() {
  const [packages, setPackages] = useState([]);
  const [regions, setRegions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');

        const [packagesData, regionsData, bookingsData, blockedDatesData] =
          await Promise.all([
          fetchJson('/packages'),
          fetchJson('/regions?active=true'),
          fetchJson('/bookings/public'),
          fetchJson('/blocked-dates?active=true'),
        ]);

        if (!mounted) return;

        const normalizedPackages = dedupeById(packagesData, normalizePackage);
        const normalizedRegions = dedupeById(regionsData, normalizeRegion);
        const normalizedBookings = bookingsData.map(normalizeBooking);
        const normalizedBlockedDates = blockedDatesData.map(normalizeBlockedDate);

        setPackages(normalizedPackages);
        setRegions(normalizedRegions);
        setBookings(normalizedBookings);
        setBlockedDates(normalizedBlockedDates);
        setForm((prev) => ({
          ...prev,
          packageId: prev.packageId || normalizedPackages[0]?.id || '',
        }));
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError.message || 'Failed to load booking setup.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === form.packageId) ?? null,
    [packages, form.packageId],
  );

  const selectedRegion = useMemo(
    () => regions.find((item) => item.id === form.regionId) ?? null,
    [regions, form.regionId],
  );

  const totalAmount = useMemo(() => {
    if (!selectedPackage) return 0;
    if (!form.regionId) return selectedPackage.price;

    const regionalMatch = selectedPackage.regionPrices.find(
      (item) => item.regionId === form.regionId,
    );
    return regionalMatch?.price ?? selectedPackage.price;
  }, [selectedPackage, form.regionId]);

  const advanceAmount = selectedPackage?.advanceAmount ?? 0;

  const calendarDays = useMemo(
    () => buildCalendarDays(currentMonth, blockedDates),
    [currentMonth, blockedDates],
  );

  const onFieldChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setShowConfirmation(false);
  };

  const onCalendarDayClick = (day) => {
    if (day.isLocked) {
      setActiveTooltip((current) =>
        current?.value === day.value
          ? null
          : {
              value: day.value,
              message: day.lockMessage || 'This date is not available.',
            },
      );
      return;
    }

    setActiveTooltip(null);
    setForm((prev) => ({
      ...prev,
      selectedDate: day.value,
    }));
  };

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedPackage) {
      setError('Please select a package.');
      return;
    }

    if (!form.customerName.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('Please complete the required personal details.');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!form.selectedDate) {
      setError('Please choose an available event date.');
      return;
    }

    const bookingStart = new Date(`${form.selectedDate}T09:00:00`);
    const bookingEnd = new Date(`${form.selectedDate}T10:00:00`);

    const payload = {
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      packageId: selectedPackage.id,
      regionId: selectedRegion?.id ?? '',
      service: selectedPackage.name,
      region: selectedRegion?.name ?? '',
      status: 'pending',
      bookingDate: bookingStart.toISOString(),
      serviceStart: bookingStart.toISOString(),
      serviceEnd: bookingEnd.toISOString(),
      totalPrice: totalAmount,
      advanceAmount,
      discountAmount: 0,
      discountType: 'inr',
      discountValue: 0,
      assignedStaff: [],
      addons: [],
    };

    try {
      setSaving(true);
      setError('');

      const createdBooking = normalizeBooking(
        await fetchJson('/bookings/public', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );

      setBookings((prev) => [createdBooking, ...prev]);
      setShowConfirmation(true);
    } catch (saveError) {
      setError(saveError.message || 'Failed to submit booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="booking-page-shell">
      <div className="luxury-blur blur-one" />
      <div className="luxury-blur blur-two" />
      <div className="luxury-blur blur-three" />

      <header className="page-header">
        <div className="brand">
          <div className="brand-icon">
            <img src={nizanLogo} alt="Nizan Makeovers logo" />
          </div>
          <span className="brand-text">Nizan Makeovers</span>
        </div>
      </header>

      <main className="page-main">
        <section className="hero-section">
          <div className="hero-pill">
            <ion-icon name="sparkles-outline" />
            Exclusive Experience
          </div>
          <h1>Book Your Makeover Session</h1>
          <p>
            Choose your package, select your event date, and confirm your
            request with advance payment. Prepare for a transformation that
            defines your best self.
          </p>
        </section>

        <section className="booking-card-shell">
          <div className="booking-card">
            {error ? <div className="notice-banner error">{error}</div> : null}

            {loading ? (
              <div className="loading-panel">
                Loading packages, regions, and live CRM availability...
              </div>
            ) : showConfirmation ? (
              <ConfirmationCard
                onBookAnother={() => {
                  setShowConfirmation(false);
                  setError('');
                  setForm({
                    ...initialForm,
                    packageId: packages[0]?.id || '',
                  });
                }}
              />
            ) : (
              <form onSubmit={handleSubmit} className="booking-form">
                <BookingSection
                  icon="person-outline"
                  title="Personal Details"
                >
                  <div className="field-grid">
                    <Field
                      label="Full Name"
                      required
                      className="span-2"
                      value={form.customerName}
                      onChange={onFieldChange('customerName')}
                      placeholder="e.g. Alexandra Sterling"
                      icon="person-outline"
                    />
                    <Field
                      label="Phone Number"
                      required
                      value={form.phone}
                      onChange={onFieldChange('phone')}
                      placeholder="+91 98765 43210"
                      icon="call-outline"
                    />
                    <Field
                      label="Email Address"
                      required
                      value={form.email}
                      onChange={onFieldChange('email')}
                      placeholder="alexandra@example.com"
                      icon="mail-outline"
                    />
                  </div>
                </BookingSection>

                <BookingSection
                  icon="location-outline"
                  title="Session Selection"
                >
                  <div className="field-grid">
                    <SelectField
                      label="Select Event Location"
                      value={form.regionId}
                      onChange={onFieldChange('regionId')}
                      icon="location-outline"
                      options={[
                        { value: '', label: 'Default / Base pricing' },
                        ...regions.map((item) => ({
                          value: item.id,
                          label: item.name,
                        })),
                      ]}
                    />
                    <div>
                      <SelectField
                        label="Select Package"
                        required
                        value={form.packageId}
                        onChange={onFieldChange('packageId')}
                        options={packages.map((item) => ({
                          value: item.id,
                          label: item.name,
                        }))}
                      />
                      <div className="helper-inline">
                        <ion-icon name="information-circle-outline" />
                        Advance required to confirm booking
                      </div>
                    </div>
                  </div>
                </BookingSection>

                <BookingSection
                  icon="time-outline"
                  title="Date & Timing"
                >
                  <div className="calendar-layout">
                    <div>
                      <label className="field-label">Event Dates</label>
                      <div className="calendar-card">
                        <div className="calendar-head">
                          <div className="calendar-month">
                            {formatMonthYear(currentMonth)}
                          </div>
                          <div className="calendar-nav">
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              onClick={() =>
                                setCurrentMonth(addMonths(currentMonth, -1))
                              }
                            >
                              <ion-icon name="chevron-back-outline" />
                            </button>
                            <button
                              type="button"
                              className="calendar-nav-btn"
                              onClick={() =>
                                setCurrentMonth(addMonths(currentMonth, 1))
                              }
                            >
                              <ion-icon name="chevron-forward-outline" />
                            </button>
                          </div>
                        </div>

                        <div className="calendar-weekdays">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                            (day) => (
                              <span key={day}>{day}</span>
                            ),
                          )}
                        </div>

                        <div className="calendar-grid">
                          {calendarDays.map((day) => {
                            const className = [
                              'calendar-day',
                              !day.isCurrentMonth ? 'outside' : '',
                              day.isLocked ? 'locked' : '',
                              form.selectedDate === day.value ? 'selected' : '',
                            ]
                              .filter(Boolean)
                              .join(' ');

                            return (
                              <div
                                key={`${day.value}-${day.label}`}
                                className="calendar-day-wrap"
                                onMouseEnter={() => {
                                  if (!day.isLocked) return;
                                  setActiveTooltip({
                                    value: day.value,
                                    message: day.lockMessage,
                                  });
                                }}
                                onMouseLeave={() => {
                                  setActiveTooltip((current) =>
                                    current?.value === day.value ? null : current,
                                  );
                                }}
                              >
                                <button
                                  type="button"
                                  className={className}
                                  aria-disabled={day.isLocked}
                                  onClick={() => onCalendarDayClick(day)}
                                >
                                  {day.label}
                                </button>
                                {activeTooltip?.value === day.value ? (
                                  <div className="calendar-tooltip" role="tooltip">
                                    {activeTooltip.message}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="calendar-hint">
                          <ion-icon name="information-circle-outline" />
                          Tap to select a date. Fully booked days are locked.
                        </div>
                      </div>

                      <div className="selected-date-pills">
                        {form.selectedDate ? (
                          <span className="selected-date-pill">
                            {formatDate(new Date(`${form.selectedDate}T00:00:00`))}
                          </span>
                        ) : (
                          <span className="selected-date-pill muted">
                            No date selected yet
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="timing-summary-column">
                      <div className="field-block">
                        <label className="field-label">Booking Status</label>
                        <div className="time-empty static-card">
                          {form.selectedDate
                            ? 'Your selected date will be sent to our sales team. Exact timing will be confirmed by admin.'
                            : 'Select your preferred date. Timing will be coordinated by the admin team later.'}
                        </div>
                      </div>

                      <div className="summary-panel">
                        <div className="summary-row">
                          <span>Session Duration</span>
                          <strong>1 Day</strong>
                        </div>
                        <div className="summary-row">
                          <span>Preferred Date</span>
                          <strong>
                            {form.selectedDate
                              ? formatDate(new Date(`${form.selectedDate}T00:00:00`))
                              : 'Not selected'}
                          </strong>
                        </div>
                        <div className="summary-divider" />
                        <div className="advance-summary">
                          <div>
                            <div className="advance-title">
                              Advance to Confirm
                            </div>
                            <div className="advance-note">
                              Advance payment confirms your slot instantly.
                            </div>
                          </div>
                          <div className="advance-amount">
                            ₹{formatCurrency(advanceAmount)}
                          </div>
                        </div>
                        <div className="summary-footnote">
                          {form.selectedDate
                            ? `${formatDate(
                                new Date(`${form.selectedDate}T00:00:00`),
                              )} is available. Admin can block whole dates from CRM, but time is not selected by the client.`
                            : 'Choose your date to see live availability.'}
                        </div>
                      </div>
                    </div>
                  </div>
                </BookingSection>

                <div className="form-footer">
                  <button
                    type="submit"
                    className="submit-button"
                    disabled={saving}
                  >
                    <span>
                      {saving
                        ? 'Submitting Booking Request...'
                        : 'Confirm & Pay Advance'}
                    </span>
                    <ion-icon name="chevron-forward-outline" />
                  </button>
                  <div className="checkout-note">
                    Secure 256-bit encrypted checkout
                  </div>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="trust-strip">
          <div className="trust-item">
            <ion-icon name="checkmark-circle-outline" />
            Certified Artist
          </div>
          <div className="trust-item">
            <ion-icon name="checkmark-circle-outline" />
            Premium Products
          </div>
          <div className="trust-item">
            <ion-icon name="checkmark-circle-outline" />
            Trusted Booking Flow
          </div>
        </section>
      </main>
    </div>
  );
}

function ConfirmationCard({ onBookAnother }) {
  return (
    <div className="confirmation-shell">
      <div className="confirmation-brand">
        <ion-icon name="sparkles-outline" />
        Nizan Makeovers
      </div>

      <div className="confirmation-card">
        <div className="confirmation-glow" />
        <div className="confirmation-check">
          <ion-icon name="checkmark-outline" />
        </div>
        <h2>Booking Confirmed!</h2>
        <div className="confirmation-message">
          <ion-icon name="person-outline" />
          <p>Our sales team will reach out to you shortly.</p>
        </div>
        <button
          type="button"
          className="confirmation-secondary"
          onClick={onBookAnother}
        >
          Book Another Session
          <ion-icon name="chevron-forward-outline" />
        </button>
      </div>
    </div>
  );
}

function BookingSection({ icon, title, children }) {
  return (
    <section className="booking-section">
      <div className="section-heading">
        <div className="section-icon">
          <ion-icon name={icon} />
        </div>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required = false,
  value,
  onChange,
  placeholder,
  icon,
  className = '',
}) {
  return (
    <div className={['field-group', className].filter(Boolean).join(' ')}>
      <label className="field-label">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="input-shell">
        {icon ? <ion-icon name={icon} /> : null}
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  required = false,
  value,
  onChange,
  options,
  icon,
}) {
  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="input-shell select-shell">
        {icon ? <ion-icon name={icon} /> : null}
        <select value={value} onChange={onChange}>
          {options.map((option) => (
            <option key={`${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ion-icon name="chevron-down-outline" />
      </div>
    </div>
  );
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null
        ? data.message || data.details || 'Request failed'
        : String(data);
    throw new Error(message);
  }

  return data;
}

function dedupeById(items, normalizer) {
  const seen = new Set();
  return items
    .map((item) => normalizer(item))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeEntity(item) {
  return {
    ...item,
    id: item._id ?? item.id ?? '',
  };
}

function normalizeRegion(item) {
  return normalizeEntity(item);
}

function normalizePackage(item) {
  const normalized = normalizeEntity(item);
  return {
    ...normalized,
    price: Number(normalized.price ?? 0),
    advanceAmount: Number(normalized.advanceAmount ?? 3000),
    regionPrices: (normalized.regionPrices ?? []).map((regionPrice) => {
      const region = regionPrice.region;
      return {
        ...regionPrice,
        regionId:
          (typeof region === 'object' && region !== null
            ? region._id ?? region.id
            : region) ??
          regionPrice.regionId ??
          '',
        price: Number(regionPrice.price ?? 0),
      };
    }),
  };
}

function normalizeBooking(item) {
  return {
    ...item,
    id: item._id ?? item.id ?? '',
    bookingDate: item.bookingDate ?? item.serviceStart,
    serviceStart: item.serviceStart,
    serviceEnd: item.serviceEnd,
  };
}

function normalizeBlockedDate(item) {
  return {
    id: item._id ?? item.id ?? '',
    date: item.date,
    reason: item.reason ?? '',
    active: item.active ?? true,
  };
}

function isDateBlocked(date, blockedDates) {
  const key = stripTime(date);
  return blockedDates.some((item) => stripTime(new Date(item.date)) === key);
}

function getBlockedDateEntry(date, blockedDates) {
  const key = stripTime(date);
  return blockedDates.find((item) => stripTime(new Date(item.date)) === key) ?? null;
}

function buildCalendarDays(month, blockedDates) {
  const monthStart = startOfMonth(month);
  const firstWeekDay = monthStart.getDay();
  const calendarStart = addDays(monthStart, -firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(calendarStart, index);
    const isPast = stripTime(date) < stripTime(new Date());
    const blockedEntry = getBlockedDateEntry(date, blockedDates);
    const isLocked = isPast || Boolean(blockedEntry);

    return {
      value: toDateInputValue(date),
      label: date.getDate(),
      isCurrentMonth: date.getMonth() === month.getMonth(),
      isLocked,
      lockMessage: isPast
        ? 'This date has already passed and is no longer available.'
        : blockedEntry?.reason?.trim() || 'This date is not available for booking.',
    };
  });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function toDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatMonthYear(date) {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default App;
