import Link from "next/link";
import { MemberShell } from "../../components/MemberShell";
import { LearningWorkflowRail } from "../../components/LearningWorkflowRail.tsx";
import { IDEA_CATEGORIES, statusLabel } from "../../ideas/lib.ts";

type PreviewIdea = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  isShortlisted: boolean;
  authorName: string;
  foundingNumber: number | null;
  votes: number;
  comments: number;
};

const IDEAS: PreviewIdea[] = [
  {
    id: "session-replay-scorecard",
    title: "Add a weekly process scorecard to Session Replay",
    description:
      "Summarise checklist completion, patience, rule adherence and review notes across the week so members can improve process without turning results into a leaderboard.",
    category: "Trading journal",
    status: "planned",
    isShortlisted: true,
    authorName: "Jamie · example member",
    foundingNumber: 12,
    votes: 48,
    comments: 11,
  },
  {
    id: "mobile-market-pulse",
    title: "A compact mobile Market Pulse strip",
    description:
      "Keep ES, VIX, DXY, yields, session status and the current participation permission visible in one swipe-friendly strip on smaller screens.",
    category: "Mobile experience",
    status: "in_development",
    isShortlisted: true,
    authorName: "Taylor · example member",
    foundingNumber: 27,
    votes: 43,
    comments: 8,
  },
  {
    id: "catalyst-reminders",
    title: "Optional reminders before verified high-impact catalysts",
    description:
      "Let members choose a quiet reminder window before listed releases, with the same fail-closed language already used by Bullseye.",
    category: "Risk management",
    status: "under_review",
    isShortlisted: false,
    authorName: "Morgan · example member",
    foundingNumber: null,
    votes: 31,
    comments: 6,
  },
  {
    id: "custom-dashboard-density",
    title: "Remember compact or comfortable dashboard density",
    description:
      "Save the selected workspace density on the device so the command centre opens in the member's preferred presentation each day.",
    category: "Mission Control",
    status: "released",
    isShortlisted: false,
    authorName: "Avery · example member",
    foundingNumber: 4,
    votes: 29,
    comments: 5,
  },
  {
    id: "confidence-history",
    title: "Show a simple confidence-history trail",
    description:
      "Display when verified evidence strengthened, weakened or remained incomplete, without implying that confidence is a guarantee of direction.",
    category: "Market intelligence",
    status: "planned",
    isShortlisted: false,
    authorName: "Casey · example member",
    foundingNumber: 19,
    votes: 24,
    comments: 7,
  },
  {
    id: "membership-receipts",
    title: "Download membership receipts from Profile",
    description:
      "Provide a clear receipts area beside billing management so members can find prior subscription documents without leaving the account centre.",
    category: "Account and membership",
    status: "under_review",
    isShortlisted: false,
    authorName: "Riley · example member",
    foundingNumber: null,
    votes: 17,
    comments: 3,
  },
];

function PreviewIdeaCard({ idea }: { idea: PreviewIdea }) {
  return (
    <article className="ideaCard" id={`preview-${idea.id}`}>
      <div className="ideaVoteCount">
        <strong>{idea.votes}</strong>
        <span>votes</span>
      </div>
      <div>
        <header>
          <span>{idea.category}</span>
          <b data-status={idea.status}>{statusLabel(idea.status)}</b>
        </header>
        <h3>
          <Link href={`#preview-${idea.id}`}>{idea.title}</Link>
        </h3>
        <p>{idea.description}</p>
        <footer>
          <span>
            By {idea.authorName}
            {idea.foundingNumber ? ` · Founding Member #${idea.foundingNumber}` : ""}
          </span>
          <span>{idea.comments} comments</span>
        </footer>
      </div>
    </article>
  );
}

function PreviewIdeaForm() {
  return (
    <form className="ideaForm" aria-labelledby="submit-idea-title">
      <div>
        <span>MEMBER INPUT · EXAMPLE</span>
        <h2 id="submit-idea-title">Submit an idea</h2>
        <p>Tell us what would make your preparation workflow clearer or more useful.</p>
      </div>
      <label>
        Title
        <input
          name="title"
          minLength={5}
          maxLength={120}
          placeholder="A concise description of your idea"
          readOnly
        />
      </label>
      <label>
        Category
        <select name="category" defaultValue="Mission Control">
          {IDEA_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="ideaFormWide">
        Description
        <textarea
          name="description"
          minLength={20}
          maxLength={2000}
          rows={6}
          placeholder="Describe the problem, your proposed improvement and why it would help."
          readOnly
        />
      </label>
      <button type="button" aria-describedby="preview-idea-form-note">
        Submit for review <span>↗</span>
      </button>
      <p className="ideaFormMessage" id="preview-idea-form-note" role="status">
        Example form only — nothing is submitted from this private preview.
      </p>
    </form>
  );
}

export function RealIdeasPreview() {
  const shortlisted = IDEAS.filter((idea) => idea.isShortlisted);

  return (
    <MemberShell active="ideas" className="marketingRealMemberPreview">
      <aside className="dashPartialBanner" role="status">
        <strong>EXAMPLE-ONLY MEMBER EXPERIENCE</strong>
        <span>All ideas, votes, comments and member details on this private preview are illustrative.</span>
      </aside>
      <div className="ideasPage">
        <LearningWorkflowRail active="ideas" />
        <header className="ideasHero">
          <div>
            <span>MEMBER PRODUCT COUNCIL</span>
            <h1>Help shape what NASH builds next.</h1>
            <p>
              Suggest improvements, discuss member ideas and vote for the features that would make your
              preparation workflow clearer. This is product feedback — not market advice.
            </p>
            <p>
              Educational opportunity conditions live on the{" "}
              <Link href="/marketing-preview">Dashboard Opportunity Radar</Link>.
            </p>
          </div>
          <div className="ideasHeroPulse" aria-label={`${IDEAS.length} illustrative member ideas in this view`}>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
              <span />
            </div>
            <span>Community signal</span>
            <strong>{IDEAS.length}</strong>
            <small>ideas in view</small>
          </div>
        </header>

        <section className="monthlyShortlist">
          <header>
            <div>
              <span>MONTHLY FEATURE VOTE · EXAMPLE</span>
              <h2>Member shortlist</h2>
            </div>
            <p>Choose one shortlisted improvement for this illustrative calendar month.</p>
          </header>
          <div>
            {shortlisted.map((idea) => (
              <PreviewIdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        </section>

        <div className="ideasLayout">
          <PreviewIdeaForm />
          <section className="ideasBrowse" aria-labelledby="ideas-title">
            <header>
              <div>
                <span>COMMUNITY ROADMAP · EXAMPLE</span>
                <h2 id="ideas-title">Member ideas</h2>
              </div>
              <form className="ideaFilters">
                <label>
                  Status
                  <select name="status" defaultValue="">
                    <option value="">All statuses</option>
                    <option value="under_review">Under review</option>
                    <option value="planned">Planned</option>
                    <option value="in_development">In development</option>
                    <option value="released">Released</option>
                    <option value="declined">Declined</option>
                  </select>
                </label>
                <label>
                  Sort
                  <select name="sort" defaultValue="votes">
                    <option value="newest">Newest</option>
                    <option value="votes">Most voted</option>
                  </select>
                </label>
                <button type="button">Apply</button>
              </form>
            </header>
            <div className="ideaList">
              {IDEAS.map((idea) => (
                <PreviewIdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </MemberShell>
  );
}
