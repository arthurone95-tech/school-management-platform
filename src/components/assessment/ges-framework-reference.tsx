import { GES_REFERENCE_SECTIONS } from "@/lib/school/ges-framework";

/**
 * Read-only explanation of the GES / NaCCA preset.
 *
 * Uses native `<details>` elements so the disclosure works without JavaScript
 * and is keyboard accessible. The outer panel and every section start closed.
 */
export function GesFrameworkReference() {
  return (
    <details className="framework-ref">
      <summary className="framework-ref__summary">
        <span className="framework-ref__title">
          How the GES / NaCCA standard works
        </span>
        <span className="framework-ref__hint">View reference</span>
      </summary>

      <div className="framework-ref__body stack stack--sm">
        <p className="muted" style={{ margin: 0 }}>
          This preset is read-only. It follows the Ghana Education Service and
          NaCCA structure for classes, subjects, scoring and reporting.
        </p>

        {GES_REFERENCE_SECTIONS.map((section) => (
          <details className="framework-ref__section" key={section.id}>
            <summary className="framework-ref__section-summary">
              <span>{section.title}</span>
              <span className="framework-ref__chevron" aria-hidden="true">
                ▾
              </span>
            </summary>
            <div className="framework-ref__section-body">
              <p style={{ marginTop: 0 }}>{section.summary}</p>

              {section.points.length > 0 ? (
                <ul className="framework-ref__list">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}

              {section.subjects && section.subjects.length > 0 ? (
                <div className="framework-ref__subjects">
                  <p className="framework-ref__subjects-title">
                    Subjects in this group
                  </p>
                  <ul className="framework-ref__chips">
                    {section.subjects.map((subject) => (
                      <li key={subject} className="framework-ref__chip">
                        {subject}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {section.table ? (
                <div className="framework-ref__table-wrap">
                  <table className="framework-ref__table">
                    <thead>
                      <tr>
                        {section.table.headers.map((header) => (
                          <th key={header} scope="col">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row.join("|")}>
                          {row.map((cell) => (
                            <td key={cell}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
