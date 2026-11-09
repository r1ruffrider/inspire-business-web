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
          <h1 className="h2" id="team-h">
            Meet the team.
          </h1>
          <p className="lead">The people who handle a project from the first request through launch.</p>
        </div>
        <ul className="team">
          {team.map((member, index) => (
            <li key={`${member.name}-${member.role}`}>
              <article className="member">
                <MemberPhoto member={member} eager={index < 3} priority={index === 0} />
                <h2 className={member.pending ? "member__name member__name--pending" : "member__name"} translate="no">
                  {member.name}
                </h2>
                <p className={member.rolePending ? "member__role member__role--pending" : "member__role"}>{member.role}</p>
                <p className={member.bioPending ? "member__bio member__bio--pending" : "member__bio"}>{member.bio}</p>
              </article>
            </li>
          ))}
        </ul>
        <div className="team__cta">
          <RequestCta variant="secondary" href="/#request-services" />
        </div>
      </div>
    </section>
  )
}

function headshotAlt(member: TeamMember): string {
  if (member.rolePending) return `Headshot of ${member.name}`
  return `Headshot of ${member.name}, ${member.role}`
}

function MemberPhoto({ member, eager, priority }: { member: TeamMember; eager: boolean; priority: boolean }) {
  return (
    <div className="member__photo">
      <span className="member__initials" aria-hidden="true">
        {member.initials}
      </span>
      {member.image ? (
        <img
          src={member.image}
          alt={headshotAlt(member)}
          width={600}
          height={600}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          onError={(e) => {
            e.currentTarget.hidden = true
          }}
        />
      ) : null}
    </div>
  )
}
