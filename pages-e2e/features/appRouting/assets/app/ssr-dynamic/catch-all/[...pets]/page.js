export const runtime = "edge";

export default function SSRDynamicCatchAllPage({ params }) {
  return (
    <div>
      <p>The provided pets are:</p>
      <ul>
        {
          params.pets.map((pet, i) => {
            const text = `${i} - ${pet}`;
            return <li key={pet}>{text}</li>
          })
        }
      </ul>
    </div>
  );
}
