import { RequestCta } from "@/components/ui/actions"

/**
 * The one full-width brand band: end-of-products repeat of the one action.
 * Inverse button (white fill, near-black label); focus ring turns white here.
 */
export default function CtaBand() {
  return (
    <section className="band on-brand" aria-labelledby="band-h">
      <div className="wrap band__in">
        <h2 className="band__t" id="band-h">
          Need a website, a logo or branding?
        </h2>
        <RequestCta variant="inverse" />
      </div>
    </section>
  )
}
