"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField, TextField } from "@/components/ui/form";
import type {
  AssessmentSummary,
  ResultSheet,
} from "@/lib/academics/types";
import {
  attendanceStatusLabel,
  formatCalendarDate,
  formatDateTime,
  formatMeasure,
  portalStateLabel,
} from "@/lib/domain/display";
import {
  GENDERS,
  parseEnrolmentInput,
  parseLearnerCorrectionInput,
  parseLearnerStatusFilter,
  type Gender,
  type LearnerStatus,
} from "@/lib/enrolment/requests";
import type {
  ClassSummary,
  LearnerDetail,
  LearnerSummary,
} from "@/lib/enrolment/types";
import { roleLabel } from "@/lib/staff/roles";

type ClassesState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly classes: ClassSummary[] }
  | { readonly kind: "error"; readonly message: string };

type ListState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly learners: LearnerSummary[];
      readonly page: number;
      readonly pageSize: number;
      readonly total: number;
    }
  | { readonly kind: "error"; readonly message: string };

/** Which inline editor is open for which student. */
type RowEditor =
  | { readonly learnerId: string; readonly mode: "profile" }
  | { readonly learnerId: string; readonly mode: "details" }
  | { readonly learnerId: string; readonly mode: "class" };

interface EnrolSuccess {
  readonly name: string;
  readonly username: string;
  readonly className: string;
  readonly completedExisting: boolean;
}

type PrintTarget =
  | { readonly kind: "list"; readonly key: number }
  | { readonly kind: "profile"; readonly key: number }
  | null;

interface IssuedCredential {
  readonly purpose: "activation" | "reset";
  readonly code: string;
  readonly expiresAt: string;
}

const GENDER_OPTIONS = [
  { value: "", label: "Select…" },
  ...GENDERS.map((gender) => ({
    value: gender,
    label: gender.charAt(0).toUpperCase() + gender.slice(1),
  })),
];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  registrationNumber: "",
  gender: "" as Gender | "",
  dateOfBirth: "",
  residentialAddress: "",
  guardianPhone: "",
  guardianEmail: "",
  healthStatus: "",
  classId: "",
};

const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

async function fetchClasses(): Promise<ClassesState> {
  let response: Response;
  try {
    response = await fetch("/api/staff/classes", {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { kind: "error", message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly classes?: ClassSummary[];
  };
  if (!response.ok || payload.ok !== true || !payload.classes) {
    return {
      kind: "error",
      message: payload.error ?? "The classes could not be loaded.",
    };
  }
  return { kind: "ready", classes: payload.classes };
}

async function fetchLearners(
  page: number,
  status: LearnerStatus | "all",
  search?: string,
  classId?: string,
  gender: Gender | "all" = "all",
): Promise<ListState> {
  let response: Response;
  try {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("status", status);
    if (search && search.trim()) params.set("search", search.trim());
    if (classId) params.set("classId", classId);
    if (gender !== "all") params.set("gender", gender);
    response = await fetch(`/api/staff/learners?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { kind: "error", message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly learners?: LearnerSummary[];
    readonly page?: number;
    readonly pageSize?: number;
    readonly total?: number;
  };
  if (
    !response.ok ||
    payload.ok !== true ||
    !payload.learners ||
    typeof payload.page !== "number" ||
    typeof payload.pageSize !== "number" ||
    typeof payload.total !== "number"
  ) {
    return {
      kind: "error",
      message: payload.error ?? "The students could not be loaded.",
    };
  }
  return {
    kind: "ready",
    learners: payload.learners,
    page: payload.page,
    pageSize: payload.pageSize,
    total: payload.total,
  };
}

async function fetchDetail(
  learnerId: string,
): Promise<
  | { readonly ok: true; readonly learner: LearnerDetail }
  | { readonly ok: false; readonly message: string }
> {
  let response: Response;
  try {
    response = await fetch("/api/staff/learners/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId }),
    });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly learner?: LearnerDetail;
  };
  if (!response.ok || payload.ok !== true || !payload.learner) {
    return {
      ok: false,
      message: payload.error ?? "The student's record could not be loaded.",
    };
  }
  return { ok: true, learner: payload.learner };
}

function fullName(learner: LearnerSummary): string {
  return `${learner.firstName} ${learner.lastName}`.trim();
}

function ProfileLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <p className="record__meta">
      <strong>{label}:</strong> {value}
    </p>
  );
}

function LearnerPrintableProfile({
  detail,
  schoolName,
}: {
  readonly detail: LearnerDetail;
  readonly schoolName: string | null;
}) {
  return (
    <div className="terminal-report-card">
      <h2>{fullName(detail)}</h2>
      <p className="muted">
        {schoolName ?? "School"} · Student profile and admission record
      </p>
      <div className="stack stack--sm">
        <ProfileLine label="Registration number" value={detail.registrationNumber} />
        <ProfileLine label="Internal student ID" value={detail.id} />
        <ProfileLine label="Sign-in username" value={detail.username} />
        <ProfileLine label="Gender" value={detail.gender} />
        <ProfileLine
          label="Date of birth"
          value={formatCalendarDate(detail.dateOfBirth)}
        />
        <ProfileLine label="Residential address" value={detail.residentialAddress} />
        <ProfileLine label="Guardian phone" value={detail.guardianPhone} />
        <ProfileLine
          label="Guardian email"
          value={detail.guardianEmail ?? "Not recorded"}
        />
        <ProfileLine
          label="Health / medical status"
          value={detail.healthStatus ?? "Not recorded"}
        />
        <ProfileLine label="Current class" value={detail.className ?? "None"} />
        <ProfileLine
          label="Enrolment status"
          value={detail.status === "active" ? "Enrolled" : "Inactive"}
        />
        <ProfileLine
          label="Registered"
          value={formatDateTime(detail.createdAt)}
        />
        <ProfileLine
          label="Portal access"
          value={portalStateLabel(detail.portalAccessState)}
        />
        <ProfileLine
          label="Last sign-in"
          value={formatDateTime(detail.lastSignInAt)}
        />
      </div>

      <h3>Class history</h3>
      {detail.placementHistory.length === 0 ? (
        <p className="muted">No class history recorded.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {detail.placementHistory.map((entry, index) => (
                <tr key={`${entry.classId}-${entry.startedAt}-${index}`}>
                  <td>{entry.className}</td>
                  <td>{formatDateTime(entry.startedAt)}</td>
                  <td>
                    {entry.isCurrent ? "Current" : formatDateTime(entry.endedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Attendance history</h3>
      {detail.attendanceHistory.length === 0 ? (
        <p className="muted">No attendance records available.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {detail.attendanceHistory.map((entry, index) => (
                <tr key={`${entry.sessionDate}-${index}`}>
                  <td>{formatCalendarDate(entry.sessionDate)}</td>
                  <td>{entry.subjectName ?? "Class session"}</td>
                  <td>{attendanceStatusLabel(entry.status)}</td>
                  <td>{entry.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Assessment results</h3>
      {detail.results.length === 0 ? (
        <p className="muted">No recorded marks available.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Date</th>
                <th>Score</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {detail.results.map((result, index) => (
                <tr key={`${result.assessmentName}-${result.assessedOn}-${index}`}>
                  <td>
                    {result.assessmentName}
                    {result.subjectName ? ` · ${result.subjectName}` : ""}
                  </td>
                  <td>{formatCalendarDate(result.assessedOn)}</td>
                  <td>
                    {formatMeasure(result.score)} / {formatMeasure(result.maxScore)}
                  </td>
                  <td>{formatMeasure(result.percentage)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LearnerPrintableList({
  learners,
  schoolName,
}: {
  readonly learners: readonly LearnerSummary[];
  readonly schoolName: string | null;
}) {
  return (
    <div className="terminal-report-card">
      <h2>Student list</h2>
      <p className="muted">{schoolName ?? "School"}</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Registration number</th>
              <th>Class</th>
              <th>Gender</th>
              <th>Status</th>
              <th>Username</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => (
              <tr key={learner.id}>
                <td>{fullName(learner)}</td>
                <td>{learner.registrationNumber}</td>
                <td>{learner.className ?? "No class"}</td>
                <td>{learner.gender}</td>
                <td>{learner.status}</td>
                <td>{learner.username}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface HistoryRow {
  readonly assessmentId: string;
  readonly name: string;
  readonly className: string;
  readonly subjectName: string | null;
  readonly assessedOn: string;
  readonly score: number | null;
  readonly maxScore: number;
  readonly percentage: number | null;
  readonly grade: string | null;
}

type HistoryState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly rows: readonly HistoryRow[] }
  | { readonly kind: "error"; readonly message: string };

/** Reads a learner's recent marks through the existing assessment APIs. */
async function fetchAcademicHistory(learnerId: string): Promise<HistoryState> {
  let response: Response;
  try {
    response = await fetch("/api/staff/assessments", {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { kind: "error", message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly assessments?: AssessmentSummary[];
  };
  if (!response.ok || payload.ok !== true || !payload.assessments) {
    return {
      kind: "error",
      message: payload.error ?? "The assessment history could not be loaded.",
    };
  }

  const recent = [...payload.assessments]
    .sort((a, b) => (a.assessedOn < b.assessedOn ? 1 : a.assessedOn > b.assessedOn ? -1 : 0))
    .slice(0, 20);
  const rows: HistoryRow[] = [];

  for (const assessment of recent) {
    let sheetResponse: Response;
    try {
      sheetResponse = await fetch(
        `/api/staff/results?assessmentId=${encodeURIComponent(assessment.id)}`,
        { headers: { Accept: "application/json" } },
      );
    } catch {
      return { kind: "error", message: NETWORK_MESSAGE };
    }
    const sheetPayload = (await sheetResponse.json().catch(() => ({}))) as {
      readonly ok?: boolean;
      readonly error?: string;
      readonly sheet?: ResultSheet;
    };
    if (!sheetResponse.ok || sheetPayload.ok !== true || !sheetPayload.sheet) {
      return {
        kind: "error",
        message: sheetPayload.error ?? "The assessment history could not be loaded.",
      };
    }
    const entry = sheetPayload.sheet.entries.find(
      (item) => item.learnerId === learnerId,
    );
    if (!entry) continue;
    rows.push({
      assessmentId: assessment.id,
      name: assessment.name,
      className: assessment.className,
      subjectName: assessment.subjectName,
      assessedOn: assessment.assessedOn,
      score: entry.score,
      maxScore: assessment.maxScore,
      percentage: entry.percentage,
      grade: entry.grade?.label ?? null,
    });
  }

  return { kind: "ready", rows };
}

export function LearnersClient({
  email,
  role,
  schoolName,
  canRead,
  canEnrol,
  canCorrect,
  canChangePlacement,
  canManageClasses,
  canReadHistory,
  canPortalManage,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canRead: boolean;
  readonly canEnrol: boolean;
  readonly canCorrect: boolean;
  readonly canChangePlacement: boolean;
  readonly canManageClasses: boolean;
  readonly canReadHistory: boolean;
  readonly canPortalManage: boolean;
}) {
  const router = useRouter();

  const [classesState, setClassesState] = useState<ClassesState>({
    kind: "loading",
  });
  const [listState, setListState] = useState<ListState>({ kind: "loading" });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<LearnerStatus | "all">("all");
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedClass, setAppliedClass] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<LearnerStatus | "all">("all");
  const [appliedGender, setAppliedGender] = useState<Gender | "all">("all");

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<EnrolSuccess | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // One inline editor at a time, for one student.
  const [editor, setEditor] = useState<RowEditor | null>(null);
  const [detailState, setDetailState] = useState<
    | { readonly kind: "loading" }
    | { readonly kind: "ready"; readonly detail: LearnerDetail }
    | { readonly kind: "error"; readonly message: string }
  >({ kind: "loading" });
  const [detailForm, setDetailForm] = useState(EMPTY_FORM);
  const [editClassId, setEditClassId] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null);
  const [printDetail, setPrintDetail] = useState<LearnerDetail | null>(null);
  const [credential, setCredential] = useState<IssuedCredential | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [historyLearnerId, setHistoryLearnerId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<HistoryState>({
    kind: "loading",
  });

  const canManageRows = canCorrect || canChangePlacement;
  const historyLearner =
    historyLearnerId && listState.kind === "ready"
      ? listState.learners.find((item) => item.id === historyLearnerId)
      : undefined;

  useEffect(() => {
    if (!canEnrol) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchClasses();
      if (!cancelled) {
        setClassesState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEnrol, reloadKey]);

  useEffect(() => {
    if (!canRead) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchLearners(
        page,
        appliedStatus,
        appliedSearch,
        appliedClass,
        appliedGender,
      );
      if (!cancelled) {
        setListState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canRead,
    page,
    appliedStatus,
    reloadKey,
    appliedSearch,
    appliedClass,
    appliedGender,
  ]);

  function requestPrint(kind: "list" | "profile") {
    setPrintTarget({ kind, key: Date.now() });
    // The print-only card is committed on the next render. Defer the browser
    // dialog so it is included, then remove the card from the normal UI.
    window.setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 0);
  }

  function reloadList() {
    setListState({ kind: "loading" });
    setReloadKey((key) => key + 1);
  }

  function closeEditor() {
    setEditor(null);
    setRowError(null);
    setConfirmingId(null);
  }

  async function openHistory(learner: LearnerSummary) {
    closeEditor();
    setHistoryLearnerId(learner.id);
    setHistoryState({ kind: "loading" });
    const next = await fetchAcademicHistory(learner.id);
    setHistoryState(next);
  }

  function goToPage(next: number) {
    closeEditor();
    setListState({ kind: "loading" });
    setPage(next);
  }



  function update<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateDetail<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setDetailForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const parsed = parseEnrolmentInput(form);
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/staff/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly learner?: LearnerSummary;
        readonly completedExisting?: boolean;
      };

      if (!response.ok || payload.ok !== true || !payload.learner) {
        setFormError(payload.error ?? "The student could not be registered.");
        return;
      }

      setSuccess({
        name: fullName(payload.learner),
        username: payload.learner.username,
        className: payload.learner.className ?? "the class",
        completedExisting: payload.completedExisting === true,
      });
      setForm({ ...EMPTY_FORM, classId: form.classId });
      setListState({ kind: "loading" });
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch {
      setFormError(NETWORK_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  /** Loads the full record on demand for either the profile or correction view. */
  async function loadDetailFor(learner: LearnerSummary, mode: "profile" | "details") {
    setRowNotice(null);
    setRowError(null);
    setConfirmingId(null);
    setCredential(null);
    setCredentialError(null);
    setEditor({ learnerId: learner.id, mode });
    setDetailState({ kind: "loading" });

    const result = await fetchDetail(learner.id);
    if (!result.ok) {
      setDetailState({ kind: "error", message: result.message });
      return;
    }

    const detail = result.learner;
    setDetailState({ kind: "ready", detail });
    setDetailForm({
      firstName: detail.firstName,
      lastName: detail.lastName,
      registrationNumber: detail.registrationNumber,
      gender: detail.gender as Gender,
      dateOfBirth: detail.dateOfBirth,
      residentialAddress: detail.residentialAddress,
      guardianPhone: detail.guardianPhone,
      guardianEmail: detail.guardianEmail ?? "",
      healthStatus: detail.healthStatus ?? "",
      classId: detail.classId ?? "",
    });
  }

  function openProfile(learner: LearnerSummary) {
    void loadDetailFor(learner, "profile");
  }

  function openDetails(learner: LearnerSummary) {
    void loadDetailFor(learner, "details");
  }

  async function issueCredential(purpose: "activation" | "reset") {
    if (detailState.kind !== "ready") {
      return;
    }
    setCredential(null);
    setCredentialError(null);
    setRowBusyId(detailState.detail.id);
    try {
      const response = await fetch("/api/admin/portal-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: detailState.detail.id,
          purpose,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly code?: string;
        readonly expiresAt?: string;
        readonly purpose?: "activation" | "reset";
      };
      if (
        !response.ok ||
        payload.ok !== true ||
        typeof payload.code !== "string" ||
        typeof payload.expiresAt !== "string" ||
        !payload.purpose
      ) {
        setCredentialError(
          payload.error ?? "The credential could not be issued.",
        );
        return;
      }
      setCredential({
        purpose: payload.purpose,
        code: payload.code,
        expiresAt: payload.expiresAt,
      });
    } catch {
      setCredentialError(NETWORK_MESSAGE);
    } finally {
      setRowBusyId(null);
    }
  }

  function openClassChange(learner: LearnerSummary) {
    setRowNotice(null);
    setRowError(null);
    setConfirmingId(null);
    setEditClassId(learner.classId ?? "");
    setEditor({ learnerId: learner.id, mode: "class" });
  }

  /**
   * Saves a correction. Only fields that differ from the loaded record are
   * sent, so an unrelated column is never touched and no empty audit event is
   * written (the endpoint applies only the fields present in the body).
   */
  async function handleSaveDetails(detail: LearnerDetail) {
    setRowError(null);
    setRowNotice(null);

    const payload: Record<string, unknown> = { learnerId: detail.id };
    if (detailForm.registrationNumber !== detail.registrationNumber) {
      payload.registrationNumber = detailForm.registrationNumber;
    }
    if (detailForm.firstName !== detail.firstName) {
      payload.firstName = detailForm.firstName;
    }
    if (detailForm.lastName !== detail.lastName) {
      payload.lastName = detailForm.lastName;
    }
    if (detailForm.gender !== detail.gender) {
      payload.gender = detailForm.gender;
    }
    if (detailForm.dateOfBirth !== detail.dateOfBirth) {
      payload.dateOfBirth = detailForm.dateOfBirth;
    }
    if (detailForm.residentialAddress !== detail.residentialAddress) {
      payload.residentialAddress = detailForm.residentialAddress;
    }
    if (detailForm.guardianPhone !== detail.guardianPhone) {
      payload.guardianPhone = detailForm.guardianPhone;
    }
    if (detailForm.guardianEmail !== (detail.guardianEmail ?? "")) {
      payload.guardianEmail = detailForm.guardianEmail;
    }
    if (detailForm.healthStatus !== (detail.healthStatus ?? "")) {
      payload.healthStatus = detailForm.healthStatus.trim() === "" ? null : detailForm.healthStatus;
    }

    if (Object.keys(payload).length === 1) {
      setRowNotice("No changes to save.");
      return;
    }

    const parsed = parseLearnerCorrectionInput(payload);
    if (!parsed.ok) {
      setRowError(parsed.message);
      return;
    }

    setRowBusyId(detail.id);
    try {
      const response = await fetch("/api/staff/learners/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const body = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
      };

      if (!response.ok || body.ok !== true) {
        setRowError(body.error ?? "The student's record could not be saved.");
        return;
      }

      closeEditor();
      setRowNotice(`Saved changes for ${fullName(detail)}.`);
      reloadList();
    } catch {
      setRowError(NETWORK_MESSAGE);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleSaveClass(learner: LearnerSummary) {
    setRowError(null);
    setRowNotice(null);

    if (editClassId === learner.classId) {
      setRowNotice("That is already the student's class.");
      return;
    }
    if (!editClassId) {
      setRowError("Choose a class for the student.");
      return;
    }

    setRowBusyId(learner.id);
    try {
      const response = await fetch("/api/staff/learners/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: learner.id, classId: editClassId }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly unchanged?: boolean;
      };

      if (!response.ok || body.ok !== true) {
        setRowError(body.error ?? "The class change could not be saved.");
        return;
      }

      closeEditor();
      setRowNotice(
        body.unchanged === true
          ? "That is already the student's class."
          : `Moved ${fullName(learner)} to the new class.`,
      );
      reloadList();
    } catch {
      setRowError(NETWORK_MESSAGE);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleSetStatus(
    learner: LearnerSummary,
    status: LearnerStatus,
  ) {
    setRowError(null);
    setRowNotice(null);
    setRowBusyId(learner.id);
    try {
      const response = await fetch("/api/staff/learners/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: learner.id, status }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
      };

      if (!response.ok || body.ok !== true) {
        setRowError(body.error ?? "The student's status could not be changed.");
        return;
      }

      setConfirmingId(null);
      closeEditor();
      setRowNotice(
        status === "inactive"
          ? `${fullName(learner)} is now inactive.`
          : `${fullName(learner)} is active again.`,
      );
      reloadList();
    } catch {
      setRowError(NETWORK_MESSAGE);
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/staff/sign-out", { method: "POST" });
    } catch {
      // Signing out is best-effort; the redirect below still applies.
    }
    router.replace("/sign-in");
    router.refresh();
  }

  const classes =
    classesState.kind === "ready"
      ? classesState.classes
      : ([] as ClassSummary[]);
  const classOptions = [
    { value: "", label: "Select a class…" },
    ...classes.map((klass) => ({ value: klass.id, label: klass.name })),
  ];
  const noClasses = classesState.kind === "ready" && classes.length === 0;

  const totalPages =
    listState.kind === "ready"
      ? Math.max(1, Math.ceil(listState.total / listState.pageSize))
      : 1;

  return (
    <>
      <div className="container stack">
        <PageHeader
          title="Students"
          description="Register a student and place them in a class. Registration numbers are unique within your school."
        />

      {!canEnrol ? (
          <Alert variant="info">
            Your role cannot enrol students yet. Only a school administrator can
            register a student.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Enrol a student"
              description="All fields are required unless marked optional. A username is generated automatically."
            />
            <CardBody className="stack stack--sm">
              {success ? (
                <Alert variant="success">
                  {success.completedExisting ? (
                    <>
                      Completed the enrolment for{" "}
                      <strong>{success.name}</strong>, placing them in{" "}
                      {success.className}. Username:{" "}
                      <strong>{success.username}</strong>.
                    </>
                  ) : (
                    <>
                      <strong>{success.name}</strong> is enrolled in{" "}
                      {success.className}. Username:{" "}
                      <strong>{success.username}</strong>.
                    </>
                  )}
                </Alert>
              ) : null}
              {formError ? <Alert variant="error">{formError}</Alert> : null}
              {classesState.kind === "error" ? (
                <Alert variant="error">{classesState.message}</Alert>
              ) : null}
              {noClasses ? (
                <Alert variant="info">
                  Your school has no active classes yet, so a student cannot be
                  placed. A class must be created before enrolment.
                  {canManageClasses ? (
                    <>
                      {" "}
                      <Link href="/dashboard/classes">Create a class</Link>.
                    </>
                  ) : null}
                </Alert>
              ) : null}

              <form className="form-grid" onSubmit={handleSubmit} noValidate>
                <TextField
                  label="First name"
                  name="firstName"
                  autoComplete="off"
                  required
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                />
                <TextField
                  label="Last name"
                  name="lastName"
                  autoComplete="off"
                  required
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                />
                <TextField
                  label="Registration number"
                  name="registrationNumber"
                  autoComplete="off"
                  required
                  hint="Unique within your school, for example ALPHA-002."
                  value={form.registrationNumber}
                  onChange={(event) =>
                    update("registrationNumber", event.target.value)
                  }
                />
                <SelectField
                  label="Gender"
                  name="gender"
                  required
                  options={GENDER_OPTIONS}
                  value={form.gender}
                  onChange={(event) =>
                    update("gender", event.target.value as Gender | "")
                  }
                />
                <TextField
                  label="Date of birth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    update("dateOfBirth", event.target.value)
                  }
                />
                <SelectField
                  label="Class"
                  name="classId"
                  required
                  options={classOptions}
                  value={form.classId}
                  disabled={classesState.kind !== "ready" || noClasses}
                  onChange={(event) => update("classId", event.target.value)}
                />
                <TextField
                  label="Residential address"
                  name="residentialAddress"
                  autoComplete="off"
                  required
                  value={form.residentialAddress}
                  onChange={(event) =>
                    update("residentialAddress", event.target.value)
                  }
                />
                <TextField
                  label="Guardian phone"
                  name="guardianPhone"
                  type="tel"
                  autoComplete="off"
                  required
                  value={form.guardianPhone}
                  onChange={(event) =>
                    update("guardianPhone", event.target.value)
                  }
                />
                <TextField
                  label="Guardian email (optional)"
                  name="guardianEmail"
                  type="email"
                  autoComplete="off"
                  value={form.guardianEmail}
                  onChange={(event) =>
                    update("guardianEmail", event.target.value)
                  }
                />
                <TextField
                  label="Health / medical status (optional)"
                  name="healthStatus"
                  autoComplete="off"
                  value={form.healthStatus}
                  onChange={(event) =>
                    update("healthStatus", event.target.value)
                  }
                />
                <div className="form-grid__actions">
                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={classesState.kind !== "ready" || noClasses}
                  >
                    {submitting ? "Registering…" : "Register student"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {!canRead ? (
          <Alert variant="info">
            Your role cannot view the student list yet.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Students"
              description={
                listState.kind === "ready" && listState.total > 0
                  ? `${listState.total} ${appliedStatus === "all" ? "" : appliedStatus + " "}student${listState.total === 1 ? "" : "s"} in your school.`
                  : appliedStatus === "inactive"
                    ? "No inactive students. Deactivated records stay here for lookup and reactivation."
                    : "The students registered in your school."
              }
              actions={
                <div className="cluster">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={reloadList}
                    loading={listState.kind === "loading"}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={listState.kind !== "ready" || listState.learners.length === 0}
                    onClick={() => requestPrint("list")}
                  >
                    Print list
                  </Button>
                </div>
              }
            />
            <CardBody className="stack stack--sm">
              <div className="cluster">
                <TextField
                  label="Search students"
                  name="student-search"
                  type="search"
                  placeholder="Name, username, registration no. or student ID"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <SelectField
                  label="Status"
                  name="status-filter"
                  options={[
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as LearnerStatus | "all")
                  }
                />
                <SelectField
                  label="Gender"
                  name="gender-filter"
                  options={[
                    { value: "all", label: "All genders" },
                    ...GENDERS.map((gender) => ({
                      value: gender,
                      label: gender.charAt(0).toUpperCase() + gender.slice(1),
                    })),
                  ]}
                  value={genderFilter}
                  onChange={(event) =>
                    setGenderFilter(event.target.value as Gender | "all")
                  }
                />
                <SelectField
                  label="Class"
                  name="class-filter"
                  options={[
                    { value: "", label: "All classes" },
                    ...(classesState.kind === "ready"
                      ? classesState.classes.map((klass) => ({
                          value: klass.id,
                          label: klass.name,
                        }))
                      : []),
                  ]}
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setAppliedSearch(searchInput);
                    setAppliedClass(classFilter);
                    setAppliedStatus(statusFilter);
                    setAppliedGender(genderFilter);
                    setPage(1);
                  }}
                >
                  Apply Filters
                </Button>
                {(appliedSearch ||
                  appliedClass ||
                  appliedStatus !== "all" ||
                  appliedGender !== "all") ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput("");
                      setClassFilter("");
                      setStatusFilter("all");
                      setGenderFilter("all");
                      setAppliedSearch("");
                      setAppliedClass("");
                      setAppliedStatus("all");
                      setAppliedGender("all");
                      setPage(1);
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </CardBody>
            {rowNotice ? (
              <CardBody>
                <Alert variant="success">{rowNotice}</Alert>
              </CardBody>
            ) : null}
            {listState.kind === "error" ? (
              <CardBody>
                <Alert variant="error">{listState.message}</Alert>
              </CardBody>
            ) : listState.kind === "loading" ? (
              <CardBody>
                <p className="muted" role="status">
                  Loading students…
                </p>
              </CardBody>
            ) : listState.learners.length === 0 ? (
              <CardBody>
                <p className="muted">
                  {statusFilter === "inactive"
                    ? "No inactive students."
                    : "No students yet. Register the first one above."}
                </p>
              </CardBody>
            ) : (
              <>
                <ul className="record-list">
                  {listState.learners.map((learner) => {
                    const editing =
                      editor?.learnerId === learner.id ? editor : null;
                    const active = learner.status === "active";

                    return (
                      <li className="record" key={learner.id}>
                        <div className="record__main">
                          {editing?.mode === "profile" ? (
                            <div className="stack stack--sm">
                              {detailState.kind === "loading" ? (
                                <p className="muted" role="status">
                                  Loading {fullName(learner)}…
                                </p>
                              ) : detailState.kind === "error" ? (
                                <Alert variant="error">
                                  {detailState.message}
                                </Alert>
                              ) : (
                                <>
                                  <p className="record__title">
                                    {fullName(detailState.detail)}
                                  </p>
                                  <ProfileLine
                                    label="Internal student ID"
                                    value={detailState.detail.id}
                                  />
                                  <ProfileLine
                                    label="Registered"
                                    value={formatDateTime(
                                      detailState.detail.createdAt,
                                    )}
                                  />
                                  <ProfileLine
                                    label="Portal access"
                                    value={portalStateLabel(
                                      detailState.detail.portalAccessState,
                                    )}
                                  />
                                  <ProfileLine
                                    label="Last sign-in"
                                    value={formatDateTime(
                                      detailState.detail.lastSignInAt,
                                    )}
                                  />
                                  <ProfileLine
                                    label="Health / medical status"
                                    value={detailState.detail.healthStatus ?? "Not recorded"}
                                  />
                                  <p className="record__meta">
                                    <strong>Class history:</strong>{" "}
                                    {detailState.detail.placementHistory.length ===
                                    0
                                      ? "None recorded"
                                      : detailState.detail.placementHistory
                                          .map(
                                            (entry) =>
                                              `${entry.className} (${formatDateTime(entry.startedAt)}${entry.isCurrent ? ", current" : ""})`,
                                          )
                                          .join(" · ")}
                                  </p>
                                  <p className="record__meta">
                                    <strong>Recent attendance:</strong>{" "}
                                    {detailState.detail.attendanceHistory.length ===
                                    0
                                      ? "None available"
                                      : detailState.detail.attendanceHistory
                                          .map(
                                            (entry) =>
                                              `${formatCalendarDate(entry.sessionDate)}: ${attendanceStatusLabel(entry.status)}`,
                                          )
                                          .join(" · ")}
                                  </p>
                                  <p className="record__meta">
                                    <strong>Recorded marks:</strong>{" "}
                                    {detailState.detail.results.length === 0
                                      ? "None available"
                                      : detailState.detail.results
                                          .map(
                                            (result) =>
                                              `${result.assessmentName} ${formatMeasure(result.score)}/${formatMeasure(result.maxScore)}`,
                                          )
                                          .join(" · ")}
                                  </p>

                                  {canPortalManage ? (
                                    <div className="stack stack--sm">
                                      <p className="muted">
                                        A code is shown once. Share it directly
                                        with the student; the platform never
                                        stores or emails the raw value.
                                      </p>
                                      <div className="cluster">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          loading={
                                            rowBusyId === detailState.detail.id
                                          }
                                          onClick={() =>
                                            void issueCredential("activation")
                                          }
                                        >
                                          Issue activation code
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          loading={
                                            rowBusyId === detailState.detail.id
                                          }
                                          onClick={() =>
                                            void issueCredential("reset")
                                          }
                                        >
                                          Issue reset code
                                        </Button>
                                      </div>
                                      {credential ? (
                                        <Alert variant="success">
                                          {credential.purpose === "activation"
                                            ? "Activation"
                                            : "Reset"}{" "}
                                          code:{" "}
                                          <strong className="mono">
                                            {credential.code}
                                          </strong>
                                          . Expires{" "}
                                          {formatDateTime(
                                            credential.expiresAt,
                                          )}
                                          .
                                        </Alert>
                                      ) : null}
                                      {credentialError ? (
                                        <Alert variant="error">
                                          {credentialError}
                                        </Alert>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="cluster">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        setPrintDetail(detailState.detail);
                                        requestPrint("profile");
                                      }}
                                    >
                                      Print profile
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={closeEditor}
                                    >
                                      Close
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : editing?.mode === "details" ? (
                            <div className="stack stack--sm">
                              {detailState.kind === "loading" ? (
                                <p className="muted" role="status">
                                  Loading {fullName(learner)}…
                                </p>
                              ) : detailState.kind === "error" ? (
                                <Alert variant="error">
                                  {detailState.message}
                                </Alert>
                              ) : (
                                <form
                                  className="form-grid"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSaveDetails(detailState.detail);
                                  }}
                                  noValidate
                                >
                                  <TextField
                                    label="First name"
                                    name={`firstName-${learner.id}`}
                                    required
                                    value={detailForm.firstName}
                                    onChange={(event) =>
                                      updateDetail(
                                        "firstName",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Last name"
                                    name={`lastName-${learner.id}`}
                                    required
                                    value={detailForm.lastName}
                                    onChange={(event) =>
                                      updateDetail(
                                        "lastName",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Registration number"
                                    name={`reg-${learner.id}`}
                                    required
                                    value={detailForm.registrationNumber}
                                    onChange={(event) =>
                                      updateDetail(
                                        "registrationNumber",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <SelectField
                                    label="Gender"
                                    name={`gender-${learner.id}`}
                                    required
                                    options={GENDER_OPTIONS}
                                    value={detailForm.gender}
                                    onChange={(event) =>
                                      updateDetail(
                                        "gender",
                                        event.target.value as Gender | "",
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Date of birth"
                                    name={`dob-${learner.id}`}
                                    type="date"
                                    required
                                    value={detailForm.dateOfBirth}
                                    onChange={(event) =>
                                      updateDetail(
                                        "dateOfBirth",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Residential address"
                                    name={`address-${learner.id}`}
                                    required
                                    value={detailForm.residentialAddress}
                                    onChange={(event) =>
                                      updateDetail(
                                        "residentialAddress",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Guardian phone"
                                    name={`phone-${learner.id}`}
                                    type="tel"
                                    required
                                    value={detailForm.guardianPhone}
                                    onChange={(event) =>
                                      updateDetail(
                                        "guardianPhone",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Guardian email (optional)"
                                    name={`email-${learner.id}`}
                                    type="email"
                                    value={detailForm.guardianEmail}
                                    onChange={(event) =>
                                      updateDetail(
                                        "guardianEmail",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <TextField
                                    label="Health / medical status (optional)"
                                    name="healthStatus"
                                    autoComplete="off"
                                    value={detailForm.healthStatus}
                                    onChange={(event) =>
                                      updateDetail("healthStatus", event.target.value)
                                    }
                                  />
                                  <p className="muted">
                                    The username{" "}
                                    <span className="mono">
                                      {learner.username}
                                    </span>{" "}
                                    is the student&rsquo;s sign-in name and does
                                    not change.
                                  </p>
                                  <div className="form-grid__actions cluster">
                                    <Button
                                      type="submit"
                                      size="sm"
                                      loading={rowBusyId === learner.id}
                                    >
                                      Save changes
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={closeEditor}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </form>
                              )}
                            </div>
                          ) : editing?.mode === "class" ? (
                            <div className="stack stack--sm">
                              <p className="record__title">
                                {fullName(learner)}
                              </p>
                              <SelectField
                                label="New class"
                                name={`class-${learner.id}`}
                                options={classOptions}
                                value={editClassId}
                                disabled={
                                  classesState.kind !== "ready" || noClasses
                                }
                                onChange={(event) =>
                                  setEditClassId(event.target.value)
                                }
                              />
                              <div className="cluster">
                                <Button
                                  size="sm"
                                  loading={rowBusyId === learner.id}
                                  disabled={
                                    classesState.kind !== "ready" || noClasses
                                  }
                                  onClick={() => handleSaveClass(learner)}
                                >
                                  Save class
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={closeEditor}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="record__title">
                                {fullName(learner)}
                              </p>
                              <p className="record__meta">
                                <span
                                  className={`badge badge--${active ? "active" : "inactive"}`}
                                >
                                  {active ? "Enrolled" : "Inactive"}
                                </span>
                                <span>
                                  {learner.className ?? "No class yet"}
                                </span>
                                <span>{learner.registrationNumber}</span>
                                <span className="mono">{learner.username}</span>
                              </p>
                            </>
                          )}
                          {editing && rowError ? (
                            <div className="stack stack--sm">
                              <Alert variant="error">{rowError}</Alert>
                            </div>
                          ) : null}
                        </div>
                        {!editing ? (
                          <div className="record__actions">
                            {canRead ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openProfile(learner)}
                              >
                                Profile
                              </Button>
                            ) : null}
                            {canCorrect ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void openDetails(learner)}
                              >
                                Edit
                              </Button>
                            ) : null}
                            {canChangePlacement && active ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openClassChange(learner)}
                              >
                                Change class
                              </Button>
                            ) : null}
                            {canCorrect ? (
                              active ? (
                                confirmingId === learner.id ? (
                                  <>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      loading={rowBusyId === learner.id}
                                      onClick={() =>
                                        handleSetStatus(learner, "inactive")
                                      }
                                    >
                                      Confirm deactivate
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setConfirmingId(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setConfirmingId(learner.id);
                                      setRowError(null);
                                    }}
                                  >
                                    Deactivate
                                  </Button>
                                )
                              ) : (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={rowBusyId === learner.id}
                                  onClick={() =>
                                    handleSetStatus(learner, "active")
                                  }
                                >
                                  Reactivate
                                </Button>
                              )
                            ) : null}
                          </div>
                        ) : null}
                        {canReadHistory && !editing ? (
                          <div className="record__actions">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void openHistory(learner)}
                            >
                              Academic history
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {totalPages > 1 ? (
                  <div className="card__footer cluster cluster--end">
                    <span className="muted">
                      Page {listState.page} of {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => goToPage(Math.max(1, listState.page - 1))}
                      disabled={listState.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        goToPage(Math.min(totalPages, listState.page + 1))
                      }
                      disabled={listState.page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        )}

        {historyLearner ? (
          <Card>
            <CardHeader
              title={`Academic history — ${fullName(historyLearner)}`}
              description="Recent recorded assessments, newest first. Marks are read from the same assessment records used by the Results page."
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHistoryLearnerId(null)}
                >
                  Close
                </Button>
              }
            />
            <CardBody className="stack stack--sm">
              {historyState.kind === "loading" ? (
                <p className="muted" role="status">Loading academic history…</p>
              ) : historyState.kind === "error" ? (
                <Alert variant="error">{historyState.message}</Alert>
              ) : historyState.rows.length === 0 ? (
                <Alert variant="info">
                  No recorded marks are available for this learner yet.
                </Alert>
              ) : (
                <ul className="record-list">
                  {historyState.rows.map((row) => (
                    <li key={row.assessmentId} className="record">
                      <div className="record__main">
                        <p className="record__title">
                          {row.name}
                          {row.subjectName ? ` — ${row.subjectName}` : ""}
                        </p>
                        <p className="record__meta">
                          {row.assessedOn} · {row.className} ·{" "}
                          {row.score === null
                            ? "not marked"
                            : `${row.score}/${row.maxScore}`}
                        </p>
                      </div>
                      <div className="record__actions">
                        {row.percentage !== null ? (
                          <span className="badge">{row.percentage}%</span>
                        ) : null}
                        {row.grade ? (
                          <span className="badge badge--active">{row.grade}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}

        {printTarget?.kind === "list" && listState.kind === "ready" ? (
          <LearnerPrintableList
            learners={listState.learners}
            schoolName={schoolName}
          />
        ) : null}
        {printTarget?.kind === "profile" && printDetail ? (
          <LearnerPrintableProfile detail={printDetail} schoolName={schoolName} />
        ) : null}
      </div>
    </>
  );
}
