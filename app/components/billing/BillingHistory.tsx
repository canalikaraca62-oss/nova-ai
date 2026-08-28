"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

export type BillingStatus =
  | "paid"
  | "pending"
  | "failed"
  | "refunded"
  | "open"
  | "void"
  | "draft"
  | "uncollectible"
  | "processing"
  | "canceled";

export interface BillingRecord {
  id: string;

  amount?: number | null;
  currency?: string | null;

  status?: BillingStatus | string | null;

  description?: string | null;

  createdAt?: string | null;
  paidAt?: string | null;

  invoiceUrl?: string | null;
  receiptUrl?: string | null;

  invoiceNumber?: string | null;

  plan?: string | null;

  metadata?: Record<string, unknown> | null;
}

export interface BillingHistoryProps {
  records?: BillingRecord[];

  loading?: boolean;

  title?: string;

  description?: string;

  emptyTitle?: string;

  emptyDescription?: string;

  className?: string;

  onDownload?: (
    record: BillingRecord
  ) => void;

  onRecordClick?: (
    record: BillingRecord
  ) => void;

  onRefresh?: () => void;
}

/* =========================================================
   HELPERS
========================================================= */

function formatCurrency(
  amount: number | null | undefined,
  currency?: string | null
) {
  const normalizedAmount =
    typeof amount === "number"
      ? amount
      : 0;

  const normalizedCurrency =
    currency?.toUpperCase() ||
    "USD";

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          normalizedCurrency,
        maximumFractionDigits: 2,
      }
    ).format(
      normalizedAmount / 100
    );
  } catch {
    return `${normalizedAmount / 100} ${normalizedCurrency}`;
  }
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function getStatusLabel(
  status?: string | null
) {
  switch (
    status?.toLowerCase()
  ) {
    case "paid":
      return "Paid";

    case "pending":
      return "Pending";

    case "processing":
      return "Processing";

    case "failed":
      return "Failed";

    case "refunded":
      return "Refunded";

    case "open":
      return "Open";

    case "void":
      return "Void";

    case "draft":
      return "Draft";

    case "uncollectible":
      return "Uncollectible";

    case "canceled":
    case "cancelled":
      return "Canceled";

    default:
      return status
        ? status.charAt(0).toUpperCase() +
            status.slice(1)
        : "Unknown";
  }
}

function getStatusStyle(
  status?: string | null
): React.CSSProperties {
  switch (
    status?.toLowerCase()
  ) {
    case "paid":
      return {
        background:
          "rgba(34, 197, 94, 0.12)",
        borderColor:
          "rgba(34, 197, 94, 0.25)",
        color:
          "rgb(74, 222, 128)",
      };

    case "pending":
    case "processing":
    case "open":
      return {
        background:
          "rgba(234, 179, 8, 0.12)",
        borderColor:
          "rgba(234, 179, 8, 0.25)",
        color:
          "rgb(250, 204, 21)",
      };

    case "failed":
    case "uncollectible":
      return {
        background:
          "rgba(239, 68, 68, 0.12)",
        borderColor:
          "rgba(239, 68, 68, 0.25)",
        color:
          "rgb(248, 113, 113)",
      };

    case "refunded":
      return {
        background:
          "rgba(168, 85, 247, 0.12)",
        borderColor:
          "rgba(168, 85, 247, 0.25)",
        color:
          "rgb(192, 132, 252)",
      };

    default:
      return {
        background:
          "rgba(148, 163, 184, 0.1)",
        borderColor:
          "rgba(148, 163, 184, 0.2)",
        color:
          "rgb(148, 163, 184)",
      };
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function BillingHistory({
  records = [],
  loading = false,

  title = "Billing History",

  description =
    "View your invoices, payments, receipts, and subscription transactions.",

  emptyTitle =
    "No billing history yet",

  emptyDescription =
    "Your invoices and payment activity will appear here.",

  className = "",

  onDownload,

  onRecordClick,

  onRefresh,
}: BillingHistoryProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    "all" | string
  >("all");

  const [
    page,
    setPage,
  ] = useState(1);

  const pageSize = 8;

  /* =====================================================
     RESET PAGE ON FILTER CHANGE
  ===================================================== */

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
  ]);

  /* =====================================================
     FILTERED RECORDS
  ===================================================== */

  const filteredRecords =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          const matchesStatus =
            statusFilter ===
              "all" ||
            record.status
              ?.toLowerCase() ===
              statusFilter
                .toLowerCase();

          if (
            !matchesStatus
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const searchable =
            [
              record.id,

              record.invoiceNumber,

              record.description,

              record.plan,

              record.status,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            normalizedSearch
          );
        }
      );
    }, [
      records,
      search,
      statusFilter,
    ]);

  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRecords.length /
          pageSize
      )
    );

  const safePage =
    Math.min(
      page,
      totalPages
    );

  const paginatedRecords =
    filteredRecords.slice(
      (safePage - 1) *
        pageSize,
      safePage *
        pageSize
    );

  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary =
    useMemo(() => {
      const paid =
        records.filter(
          (record) =>
            record.status
              ?.toLowerCase() ===
            "paid"
        );

      const totalPaid =
        paid.reduce(
          (total, record) =>
            total +
            (typeof record.amount ===
            "number"
              ? record.amount
              : 0),
          0
        );

      const pending =
        records.filter(
          (record) =>
            [
              "pending",
              "processing",
              "open",
            ].includes(
              record.status
                ?.toLowerCase() ?? ""
            )
        ).length;

      return {
        totalTransactions:
          records.length,

        totalPaid,

        pending,
      };
    }, [records]);

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  function handleDownload(
    record: BillingRecord
  ) {
    if (onDownload) {
      onDownload(record);
      return;
    }

    const url =
      record.receiptUrl ??
      record.invoiceUrl;

    if (
      url &&
      typeof window !==
        "undefined"
    ) {
      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <section
      className={className}
      style={{
        width: "100%",
        borderRadius: 24,
        border:
          "1px solid rgba(148, 163, 184, 0.12)",
        background:
          "linear-gradient(145deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.96))",
        boxShadow:
          "0 24px 80px rgba(0, 0, 0, 0.22)",
        overflow: "hidden",
      }}
    >
      {/* ===============================================
          HEADER
      =============================================== */}

      <div
        style={{
          padding:
            "28px 28px 20px",
          borderBottom:
            "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 12,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(139, 92, 246, 0.22))",
                  border:
                    "1px solid rgba(129, 140, 248, 0.22)",
                  fontSize: 20,
                }}
              >
                ◈
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    color: "#f8fafc",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing:
                      "-0.02em",
                  }}
                >
                  {title}
                </h2>

                <p
                  style={{
                    margin:
                      "5px 0 0",
                    color:
                      "#94a3b8",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              </div>
            </div>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={{
                minHeight: 42,
                padding:
                  "0 16px",
                borderRadius: 12,
                border:
                  "1px solid rgba(148, 163, 184, 0.16)",
                background:
                  "rgba(255, 255, 255, 0.03)",
                color: "#e2e8f0",
                cursor:
                  loading
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  loading
                    ? 0.6
                    : 1,
                fontWeight: 600,
              }}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          )}
        </div>

        {/* =============================================
            STATS
        ============================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginTop: 24,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background:
                "rgba(255, 255, 255, 0.025)",
              border:
                "1px solid rgba(148, 163, 184, 0.1)",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                fontWeight: 600,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
              }}
            >
              Transactions
            </div>

            <div
              style={{
                marginTop: 8,
                color: "#f8fafc",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {
                summary.totalTransactions
              }
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background:
                "rgba(255, 255, 255, 0.025)",
              border:
                "1px solid rgba(148, 163, 184, 0.1)",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                fontWeight: 600,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
              }}
            >
              Total Paid
            </div>

            <div
              style={{
                marginTop: 8,
                color:
                  "rgb(74, 222, 128)",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {formatCurrency(
                summary.totalPaid,
                records.find(
                  (record) =>
                    record.currency
                )?.currency
              )}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background:
                "rgba(255, 255, 255, 0.025)",
              border:
                "1px solid rgba(148, 163, 184, 0.1)",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: 12,
                fontWeight: 600,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
              }}
            >
              Pending
            </div>

            <div
              style={{
                marginTop: 8,
                color:
                  "rgb(250, 204, 21)",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {summary.pending}
            </div>
          </div>
        </div>
      </div>

      {/* ===============================================
          FILTERS
      =============================================== */}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          padding:
            "20px 28px",
          borderBottom:
            "1px solid rgba(148, 163, 184, 0.08)",
        }}
      >
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search invoices, plans or transactions..."
          style={{
            flex:
              "1 1 280px",
            minHeight: 44,
            padding:
              "0 14px",
            borderRadius: 12,
            border:
              "1px solid rgba(148, 163, 184, 0.15)",
            outline: "none",
            background:
              "rgba(15, 23, 42, 0.6)",
            color: "#f8fafc",
            fontSize: 14,
          }}
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          style={{
            minHeight: 44,
            minWidth: 150,
            padding:
              "0 12px",
            borderRadius: 12,
            border:
              "1px solid rgba(148, 163, 184, 0.15)",
            background:
              "rgba(15, 23, 42, 0.9)",
            color: "#e2e8f0",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">
            All statuses
          </option>

          <option value="paid">
            Paid
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="processing">
            Processing
          </option>

          <option value="failed">
            Failed
          </option>

          <option value="refunded">
            Refunded
          </option>
        </select>
      </div>

      {/* ===============================================
          CONTENT
      =============================================== */}

      {loading ? (
        <div
          style={{
            padding:
              "48px 28px",
            color: "#94a3b8",
            textAlign: "center",
          }}
        >
          Loading billing history...
        </div>
      ) : filteredRecords.length ===
        0 ? (
        <div
          style={{
            padding:
              "64px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              margin:
                "0 auto 16px",
              display: "grid",
              placeItems: "center",
              background:
                "rgba(99, 102, 241, 0.1)",
              border:
                "1px solid rgba(129, 140, 248, 0.18)",
              color:
                "#a5b4fc",
              fontSize: 24,
            }}
          >
            ◌
          </div>

          <h3
            style={{
              margin: 0,
              color: "#f1f5f9",
              fontSize: 18,
            }}
          >
            {emptyTitle}
          </h3>

          <p
            style={{
              maxWidth: 440,
              margin:
                "10px auto 0",
              color: "#94a3b8",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            {emptyDescription}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: 760,
              }}
            >
              <thead>
                <tr>
                  {[
                    "Transaction",
                    "Plan",
                    "Date",
                    "Amount",
                    "Status",
                    "Actions",
                  ].map(
                    (label) => (
                      <th
                        key={label}
                        style={{
                          padding:
                            "14px 28px",
                          textAlign:
                            label ===
                            "Amount"
                              ? "right"
                              : "left",
                          color:
                            "#64748b",
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform:
                            "uppercase",
                          letterSpacing:
                            "0.08em",
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {paginatedRecords.map(
                  (record) => (
                    <tr
                      key={record.id}
                      onClick={() =>
                        onRecordClick?.(
                          record
                        )
                      }
                      style={{
                        cursor:
                          onRecordClick
                            ? "pointer"
                            : "default",
                        borderBottom:
                          "1px solid rgba(148, 163, 184, 0.06)",
                      }}
                    >
                      <td
                        style={{
                          padding:
                            "18px 28px",
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#e2e8f0",
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {record.description ||
                            record.invoiceNumber ||
                            "Subscription payment"}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            color:
                              "#64748b",
                            fontSize: 12,
                            fontFamily:
                              "monospace",
                          }}
                        >
                          {record.invoiceNumber ||
                            record.id}
                        </div>
                      </td>

                      <td
                        style={{
                          padding:
                            "18px 28px",
                          color:
                            "#cbd5e1",
                          fontSize: 14,
                        }}
                      >
                        {record.plan ||
                          "—"}
                      </td>

                      <td
                        style={{
                          padding:
                            "18px 28px",
                          color:
                            "#94a3b8",
                          fontSize: 14,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatDate(
                          record.paidAt ||
                            record.createdAt
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "18px 28px",
                          textAlign:
                            "right",
                          color:
                            "#f8fafc",
                          fontWeight: 700,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {formatCurrency(
                          record.amount,
                          record.currency
                        )}
                      </td>

                      <td
                        style={{
                          padding:
                            "18px 28px",
                        }}
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            minHeight: 28,
                            padding:
                              "0 10px",
                            borderRadius: 999,
                            border:
                              "1px solid",
                            fontSize: 12,
                            fontWeight: 700,
                            ...getStatusStyle(
                              record.status
                            ),
                          }}
                        >
                          {getStatusLabel(
                            record.status
                          )}
                        </span>
                      </td>

                      <td
                        style={{
                          padding:
                            "18px 28px",
                        }}
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        {record.receiptUrl ||
                        record.invoiceUrl ||
                        onDownload ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(
                                record
                              )
                            }
                            style={{
                              minHeight: 36,
                              padding:
                                "0 12px",
                              borderRadius: 10,
                              border:
                                "1px solid rgba(129, 140, 248, 0.22)",
                              background:
                                "rgba(99, 102, 241, 0.1)",
                              color:
                                "#c7d2fe",
                              fontWeight: 600,
                              cursor:
                                "pointer",
                            }}
                          >
                            Receipt
                          </button>
                        ) : (
                          <span
                            style={{
                              color:
                                "#475569",
                              fontSize: 13,
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* =============================================
              PAGINATION
          ============================================= */}

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 16,
                flexWrap: "wrap",
                padding:
                  "18px 28px",
                borderTop:
                  "1px solid rgba(148, 163, 184, 0.08)",
              }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Showing{" "}
                {Math.min(
                  filteredRecords.length,
                  (safePage - 1) *
                    pageSize +
                    1
                )}
                –
                {Math.min(
                  filteredRecords.length,
                  safePage *
                    pageSize
                )}{" "}
                of{" "}
                {
                  filteredRecords.length
                }
              </span>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }
                  disabled={
                    safePage <= 1
                  }
                  style={{
                    minHeight: 38,
                    padding:
                      "0 14px",
                    borderRadius: 10,
                    border:
                      "1px solid rgba(148, 163, 184, 0.14)",
                    background:
                      "rgba(255, 255, 255, 0.025)",
                    color:
                      safePage <= 1
                        ? "#475569"
                        : "#cbd5e1",
                    cursor:
                      safePage <= 1
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1
                        )
                    )
                  }
                  disabled={
                    safePage >=
                    totalPages
                  }
                  style={{
                    minHeight: 38,
                    padding:
                      "0 14px",
                    borderRadius: 10,
                    border:
                      "1px solid rgba(148, 163, 184, 0.14)",
                    background:
                      "rgba(255, 255, 255, 0.025)",
                    color:
                      safePage >=
                      totalPages
                        ? "#475569"
                        : "#cbd5e1",
                    cursor:
                      safePage >=
                      totalPages
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}