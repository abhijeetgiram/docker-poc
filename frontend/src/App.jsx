import React from "react";
import { useState } from "react";

export default function App() {
  const [result, setResult] = useState("Click the button...");

  const handleClick = async () => {
    try {
      const res = await fetch("/api/hello");
      setResult(JSON.stringify(await res.json(), null, 2));
    } catch (err) {
      setResult("Backend not reachable: " + err);
    }
  };

  return (
    <div>
      <h1>Docker POC</h1>
      <p>
        This page runs in one container. The button calls the backend, which
        runs in another container and stores a counter in a third container
        (Redis).
      </p>
      <button onClick={handleClick}>Call backend</button>
      <pre>{result}</pre>
    </div>
  );
}
