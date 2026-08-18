import "./index.css";
import { useEffect, useState } from "react";

type Post = {
  id: number;
  title: string;
  body: string;
};

type PostsResponse = {
  posts: Post[];
};

const DUMMY_JSON_POSTS_KEY = "dummyjson-posts";

function isPost(value: unknown): value is Post {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "number" && typeof candidate.title === "string" && typeof candidate.body === "string";
}

function parseCachedPosts(raw: string): Post[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isPost)) {
    throw new Error("Cached posts have an invalid format.");
  }
  return parsed;
}

async function fetchPosts(): Promise<Post[]> {
  const response = await fetch("https://dummyjson.com/posts");
  if (!response.ok) {
    throw new Error(`Failed to fetch posts (${response.status})`);
  }

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("posts" in data)) {
    throw new Error("Received an invalid response from DummyJSON.");
  }

  const posts = (data as PostsResponse).posts;
  if (!Array.isArray(posts) || !posts.every(isPost)) {
    throw new Error("Received posts with an invalid format.");
  }

  return posts;
}

export function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPosts = async () => {
      try {
        const cachedPosts = localStorage.getItem(DUMMY_JSON_POSTS_KEY);
        if (cachedPosts) {
          const parsedPosts = parseCachedPosts(cachedPosts);
          if (isMounted) {
            setPosts(parsedPosts);
          }
          return;
        }

        const fetchedPosts = await fetchPosts();
        localStorage.setItem(DUMMY_JSON_POSTS_KEY, JSON.stringify(fetchedPosts));
        if (isMounted) {
          setPosts(fetchedPosts);
        }
      } catch (loadError) {
        localStorage.removeItem(DUMMY_JSON_POSTS_KEY);
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPosts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="post-review">
      <h1>DummyJSON Posts</h1>
      {loading && <p>Loading posts...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <div className="posts">
          {posts.map(post => (
            <article key={post.id} className="post-card">
              <h2>{post.title}</h2>
              <p>{post.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
