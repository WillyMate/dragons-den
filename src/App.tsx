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
  const [searchTerm, setSearchTerm] = useState("");

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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPosts = posts.filter(post => {
    if (!normalizedSearch) {
      return true;
    }

    const haystack = `${post.title} ${post.body}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  return (
    <div className="post-review">
      <header className="top-bar">
        <div className="top-bar__inner">
          <h1>Y' Dragon Den</h1>
          <label className="search-bar" htmlFor="post-search">
            <span className="search-bar__label">Search posts</span>
            <input
              id="post-search"
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search title or content..."
            />
          </label>
        </div>
      </header>

      {loading && <p>Loading posts...</p>}
      {error && <p>{error}</p>}
      {!loading && !error && (
        <>
          <p className="results-count">
            {filteredPosts.length} post{filteredPosts.length === 1 ? "" : "s"} found
          </p>

          {filteredPosts.length === 0 ? (
            <div className="empty-state">No posts match your search.</div>
          ) : (
            <div className="posts">
              {filteredPosts.map(post => (
                <article key={post.id} className="post-card">
                  <h2>{post.title}</h2>
                  <p>{post.body}</p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
