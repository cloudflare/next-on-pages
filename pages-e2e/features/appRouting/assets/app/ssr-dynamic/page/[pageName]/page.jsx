export const runtime = "edge";

export default function SSRDynamicPageWithName({ params }) {
  return (
    <div>
      <p>This Page's name is: {params.pageName}</p>
    </div>
  );
}
