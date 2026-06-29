async function main() {
  const res = await fetch("http://localhost:3000/periods/5", {
    headers: {
      // we might need a cookie to not get redirected to login, but let's see if we get a 307 or 404
    },
    redirect: "manual"
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
  if (res.status !== 307) {
    const text = await res.text();
    console.log("Body snippet:", text.slice(0, 500));
  }
}
main();
