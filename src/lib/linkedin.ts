type LinkedInToken = { accessToken: string; personUrn: string };

/** Uses LinkedIn's official Share on LinkedIn endpoint after OAuth connection. */
export async function publishTextPost(text: string, token: LinkedInToken) {
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: token.personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text }, shareMediaCategory: "NONE" } },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!response.ok) throw new Error(`LinkedIn publishing failed: ${response.status}`);
  return response.headers.get("x-restli-id");
}
