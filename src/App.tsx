import "./index.css";
import { useEffect, useState } from "react";

type Post = {
  id: number;
  title: string;
  body: string;
};

type CommentUser = {
  id: number;
  username: string;
  fullName: string;
};

type PostComment = {
  id: number;
  body: string;
  postId: number;
  likes: number;
  user: CommentUser;
};

type PostsResponse = {
  posts: Post[];
};

type PostCommentsResponse = {
  comments: PostComment[];
};

const DUMMY_JSON_POSTS_KEY = "dummyjson-posts";

function isPost(value: unknown): value is Post {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "number" && typeof candidate.title === "string" && typeof candidate.body === "string";
}

function isCommentUser(value: unknown): value is CommentUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.username === "string" &&
    typeof candidate.fullName === "string"
  );
}

function isPostComment(value: unknown): value is PostComment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.body === "string" &&
    typeof candidate.postId === "number" &&
    typeof candidate.likes === "number" &&
    isCommentUser(candidate.user)
  );
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

async function fetchCommentsForPost(postId: number): Promise<PostComment[]> {
  const response = await fetch(`https://dummyjson.com/posts/${postId}/comments`);
  if (!response.ok) {
    throw new Error(`Failed to fetch comments for post ${postId} (${response.status})`);
  }

  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("comments" in data)) {
    throw new Error("Received an invalid comments response from DummyJSON.");
  }

  const comments = (data as PostCommentsResponse).comments;
  if (!Array.isArray(comments) || !comments.every(isPostComment)) {
    throw new Error("Received comments with an invalid format.");
  }

  return comments;
}

export function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPostIds, setExpandedPostIds] = useState<Set<number>>(new Set());
  const [commentsByPostId, setCommentsByPostId] = useState<Record<number, PostComment[]>>({});
  const [commentsLoadingByPostId, setCommentsLoadingByPostId] = useState<Record<number, boolean>>({});
  const [commentsErrorByPostId, setCommentsErrorByPostId] = useState<Record<number, string>>({});

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

  const toggleCommentsForPost = async (postId: number) => {
    const isExpanded = expandedPostIds.has(postId);
    if (isExpanded) {
      setExpandedPostIds(current => {
        const next = new Set(current);
        next.delete(postId);
        return next;
      });
      return;
    }

    setExpandedPostIds(current => {
      const next = new Set(current);
      next.add(postId);
      return next;
    });

    if (commentsByPostId[postId] || commentsLoadingByPostId[postId]) {
      return;
    }

    setCommentsLoadingByPostId(current => ({ ...current, [postId]: true }));
    setCommentsErrorByPostId(current => {
      const next = { ...current };
      delete next[postId];
      return next;
    });

    try {
      const comments = await fetchCommentsForPost(postId);
      setCommentsByPostId(current => ({ ...current, [postId]: comments }));
    } catch (loadError) {
      setCommentsErrorByPostId(current => ({
        ...current,
        [postId]: loadError instanceof Error ? loadError.message : String(loadError)
      }));
    } finally {
      setCommentsLoadingByPostId(current => ({ ...current, [postId]: false }));
    }
  };

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
                  <button
                    type="button"
                    className="comments-toggle"
                    onClick={() => {
                      void toggleCommentsForPost(post.id);
                    }}
                  >
                    {expandedPostIds.has(post.id) ? "Hide comments" : "Show comments"}
                  </button>
                  {expandedPostIds.has(post.id) && (
                    <section className="comments-panel" aria-live="polite">
                      {commentsLoadingByPostId[post.id] ? (
                        <p className="comments-status">Loading comments...</p>
                      ) : commentsErrorByPostId[post.id] ? (
                        <p className="comments-error">{commentsErrorByPostId[post.id]}</p>
                      ) : commentsByPostId[post.id]?.length ? (
                        <ul className="comments-list">
                          {commentsByPostId[post.id].map(comment => (
                            <li key={comment.id} className="comment-card">
                              <p className="comment-body">{comment.body}</p>
                              <p className="comment-meta">
                                {comment.user.fullName} (@{comment.user.username}) · {comment.likes} like
                                {comment.likes === 1 ? "" : "s"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="comments-status">No comments for this post.</p>
                      )}
                    </section>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
