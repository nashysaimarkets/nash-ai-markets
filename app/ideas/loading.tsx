import { MemberEmptyCanvas } from "../components/MemberEmptyCanvas";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <MemberEmptyCanvas active="ideas" />
    </div>
  );
}
