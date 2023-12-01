import { useRouter } from "next/router";

export const runtime = "experimental-edge";

export default function SSRDynamicCatchAllPage() {
  const router = useRouter();

  return (
    <div>
      {!router.query.colors ? (
        <p>No color provided</p>
      ) : (
        <>
          <p>The provided colors are:</p>
          <ul>
            {router.query.colors.map((color, i) => (
              <li key={color}>{i} - {color}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
