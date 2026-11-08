import { RequestCta } from "@/components/ui/actions"
import { content } from "@/content"
import type { TeamMember } from "@/content/types"

/**
 * Meet the team. Initials until a real portrait is supplied. Cards are not links.
 * Bios stay visible. An empty roster renders nothing (the nav drops Team too).
 */
export default function Team() {
  const team = content.team
  if (team.length === 0) return null
  return (
    <section id="team" className="section" aria-labelledby="team-h">
      <div className="wrap">
        <div className="sec-head">
          <p className="mono-label">Team</p>
          <h2 className="h2" id="team-h">
            Meet the team.
          </h2>
          <p className="lead">The people who handle a project from the first request through launch.</p>
        </div>
        <ul className="team">
          {team.map((member) => (
            <li key={`${member.name}-${member.role}`}>
              <article className="member">
                <MemberPhoto member={member} />
                <h3 className={member.pending ? "member__name member__name--pending" : "member__name"} translate="no">
                  {member.name}
                </h3>
                <p className="member__role">{member.role}</p>
                <p className="member__bio">{member.bio}</p>
              </article>
            </li>
          ))}
        </ul>
        <div className="team__cta">
          <RequestCta variant="secondary" />
        </div>
      </div>
    </section>
  )
}

function MemberPhoto({ member }: { member: TeamMember }) {
  return (
    <div className="member__photo">
      <span className="member__initials" aria-hidden="true">
        {member.initials}
      </span>
      {member.image ? (
        <img
          src={member.image}
          alt={`${member.name}, ${member.role}`}
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.hidden = true
          }}
        />
      ) : null}
    </div>
  )
}
