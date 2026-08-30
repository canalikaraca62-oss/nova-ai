/**
 * SYRAVEN GitHub Integration Service
 *
 * Production-oriented GitHub REST API abstraction.
 *
 * Capabilities:
 * - Authenticate with personal access tokens
 * - Get authenticated user
 * - List repositories
 * - Get repository
 * - Create repository
 * - List branches
 * - List commits
 * - List pull requests
 * - Create pull requests
 * - Get issues
 * - Create issues
 * - Create comments
 * - Repository search
 */

export interface GitHubCredentials {
  accessToken: string;
  apiBaseUrl?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string;
  profileUrl?: string;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
}

export interface GitHubRepositoryOwner {
  id: number;
  login: string;
  type?: string;
  avatarUrl?: string;
  profileUrl?: string;
}

export interface GitHubRepository {
  id: number;
  nodeId?: string;
  name: string;
  fullName: string;
  private: boolean;
  description?: string | null;
  htmlUrl: string;
  cloneUrl?: string;
  sshUrl?: string;
  defaultBranch?: string;
  language?: string | null;
  visibility?: string;
  archived?: boolean;
  disabled?: boolean;
  fork?: boolean;
  owner: GitHubRepositoryOwner;
  createdAt?: string;
  updatedAt?: string;
  pushedAt?: string | null;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected?: boolean;
}

export interface GitHubCommitAuthor {
  name?: string;
  email?: string;
  date?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  htmlUrl?: string;
  author?: GitHubCommitAuthor;
  committer?: GitHubCommitAuthor;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  draft?: boolean;
  merged?: boolean;
  htmlUrl: string;
  head: {
    ref: string;
    sha?: string;
  };
  base: {
    ref: string;
    sha?: string;
  };
  user?: GitHubUser;
  createdAt?: string;
  updatedAt?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  htmlUrl: string;
  user?: GitHubUser;
  comments?: number;
  createdAt?: string;
  updatedAt?: string;
  labels?: string[];
}

export interface CreateRepositoryInput {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

export interface CreatePullRequestInput {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

export interface CreateIssueInput {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface CreateCommentInput {
  body: string;
}

export interface GitHubSearchResult<T> {
  totalCount: number;
  incompleteResults: boolean;
  items: T[];
}

export interface GitHubRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class GitHubIntegrationError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);

    this.name = "GitHubIntegrationError";
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

const DEFAULT_API_BASE_URL = "https://api.github.com";

function ensureNonEmpty(
  value: string,
  fieldName: string
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new GitHubIntegrationError(
      `${fieldName} is required.`,
      {
        code: "VALIDATION_ERROR",
      }
    );
  }

  return normalized;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function mapUser(data: Record<string, unknown>): GitHubUser {
  return {
    id: Number(data.id),
    login: String(data.login ?? ""),
    name:
      typeof data.name === "string"
        ? data.name
        : null,
    email:
      typeof data.email === "string"
        ? data.email
        : null,
    avatarUrl:
      typeof data.avatar_url === "string"
        ? data.avatar_url
        : undefined,
    profileUrl:
      typeof data.html_url === "string"
        ? data.html_url
        : undefined,
    company:
      typeof data.company === "string"
        ? data.company
        : null,
    location:
      typeof data.location === "string"
        ? data.location
        : null,
    bio:
      typeof data.bio === "string"
        ? data.bio
        : null,
  };
}

function mapRepository(
  data: Record<string, unknown>
): GitHubRepository {
  const owner =
    data.owner &&
    typeof data.owner === "object"
      ? (data.owner as Record<string, unknown>)
      : {};

  return {
    id: Number(data.id),
    nodeId:
      typeof data.node_id === "string"
        ? data.node_id
        : undefined,
    name: String(data.name ?? ""),
    fullName: String(data.full_name ?? ""),
    private: Boolean(data.private),
    description:
      typeof data.description === "string"
        ? data.description
        : null,
    htmlUrl: String(data.html_url ?? ""),
    cloneUrl:
      typeof data.clone_url === "string"
        ? data.clone_url
        : undefined,
    sshUrl:
      typeof data.ssh_url === "string"
        ? data.ssh_url
        : undefined,
    defaultBranch:
      typeof data.default_branch === "string"
        ? data.default_branch
        : undefined,
    language:
      typeof data.language === "string"
        ? data.language
        : null,
    visibility:
      typeof data.visibility === "string"
        ? data.visibility
        : undefined,
    archived: Boolean(data.archived),
    disabled: Boolean(data.disabled),
    fork: Boolean(data.fork),
    owner: {
      id: Number(owner.id),
      login: String(owner.login ?? ""),
      type:
        typeof owner.type === "string"
          ? owner.type
          : undefined,
      avatarUrl:
        typeof owner.avatar_url === "string"
          ? owner.avatar_url
          : undefined,
      profileUrl:
        typeof owner.html_url === "string"
          ? owner.html_url
          : undefined,
    },
    createdAt:
      typeof data.created_at === "string"
        ? data.created_at
        : undefined,
    updatedAt:
      typeof data.updated_at === "string"
        ? data.updated_at
        : undefined,
    pushedAt:
      typeof data.pushed_at === "string"
        ? data.pushed_at
        : null,
  };
}

export class GitHubService {
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;

  constructor(credentials: GitHubCredentials) {
    this.accessToken = ensureNonEmpty(
      credentials.accessToken,
      "GitHub access token"
    );

    this.apiBaseUrl = (
      credentials.apiBaseUrl ||
      DEFAULT_API_BASE_URL
    ).replace(/\/+$/, "");
  }

  private async request<T>(
    path: string,
    options: GitHubRequestOptions = {}
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(options.body
            ? {
                "Content-Type": "application/json",
              }
            : {}),
          ...options.headers,
        },
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
      });

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType =
        response.headers.get("content-type") ?? "";

      const payload = contentType.includes(
        "application/json"
      )
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          "message" in payload
            ? String(
                (payload as Record<string, unknown>)
                  .message
              )
            : `GitHub API request failed with status ${response.status}.`;

        throw new GitHubIntegrationError(
          message,
          {
            status: response.status,
            code: "GITHUB_API_ERROR",
            cause: payload,
          }
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof GitHubIntegrationError) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown GitHub request error.";

      throw new GitHubIntegrationError(
        `GitHub request failed: ${message}`,
        {
          code: "GITHUB_REQUEST_FAILED",
          cause: error,
        }
      );
    }
  }

  async getAuthenticatedUser(): Promise<GitHubUser> {
    const data = await this.request<
      Record<string, unknown>
    >("/user");

    return mapUser(data);
  }

  async listRepositories(
    options: {
      visibility?: "all" | "public" | "private";
      affiliation?: string;
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubRepository[]> {
    const params = new URLSearchParams();

    if (options.visibility) {
      params.set(
        "visibility",
        options.visibility
      );
    }

    if (options.affiliation) {
      params.set(
        "affiliation",
        options.affiliation
      );
    }

    if (options.sort) {
      params.set("sort", options.sort);
    }

    if (options.direction) {
      params.set(
        "direction",
        options.direction
      );
    }

    if (options.perPage) {
      params.set(
        "per_page",
        String(
          Math.min(
            Math.max(options.perPage, 1),
            100
          )
        )
      );
    }

    if (options.page) {
      params.set(
        "page",
        String(Math.max(options.page, 1))
      );
    }

    const query = params.toString();

    const data = await this.request<
      Array<Record<string, unknown>>
    >(`/user/repos${query ? `?${query}` : ""}`);

    return data.map(mapRepository);
  }

  async getRepository(
    owner: string,
    repository: string
  ): Promise<GitHubRepository> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/repos/${encodePathSegment(
        ensureNonEmpty(owner, "Repository owner")
      )}/${encodePathSegment(
        ensureNonEmpty(repository, "Repository name")
      )}`
    );

    return mapRepository(data);
  }

  async createRepository(
    input: CreateRepositoryInput
  ): Promise<GitHubRepository> {
    const name = ensureNonEmpty(
      input.name,
      "Repository name"
    );

    const data = await this.request<
      Record<string, unknown>
    >("/user/repos", {
      method: "POST",
      body: {
        name,
        description: input.description,
        private: input.private ?? true,
        auto_init: input.autoInit ?? true,
        gitignore_template:
          input.gitignoreTemplate,
        license_template:
          input.licenseTemplate,
      },
    });

    return mapRepository(data);
  }

  async listBranches(
    owner: string,
    repository: string
  ): Promise<GitHubBranch[]> {
    const data = await this.request<
      Array<Record<string, unknown>>
    >(
      `/repos/${encodePathSegment(
        ensureNonEmpty(owner, "Repository owner")
      )}/${encodePathSegment(
        ensureNonEmpty(repository, "Repository name")
      )}/branches`
    );

    return data.map((branch) => {
      const commit =
        branch.commit &&
        typeof branch.commit === "object"
          ? (branch.commit as Record<string, unknown>)
          : {};

      return {
        name: String(branch.name ?? ""),
        sha: String(commit.sha ?? ""),
        protected: Boolean(branch.protected),
      };
    });
  }

  async listCommits(
    owner: string,
    repository: string,
    options: {
      branch?: string;
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();

    if (options.branch) {
      params.set("sha", options.branch);
    }

    if (options.perPage) {
      params.set(
        "per_page",
        String(
          Math.min(
            Math.max(options.perPage, 1),
            100
          )
        )
      );
    }

    if (options.page) {
      params.set(
        "page",
        String(Math.max(options.page, 1))
      );
    }

    const query = params.toString();

    const data = await this.request<
      Array<Record<string, unknown>>
    >(
      `/repos/${encodePathSegment(
        ensureNonEmpty(owner, "Repository owner")
      )}/${encodePathSegment(
        ensureNonEmpty(repository, "Repository name")
      )}/commits${query ? `?${query}` : ""}`
    );

    return data.map((commit) => {
      const commitData =
        commit.commit &&
        typeof commit.commit === "object"
          ? (commit.commit as Record<string, unknown>)
          : {};

      const author =
        commitData.author &&
        typeof commitData.author === "object"
          ? (
              commitData.author as Record<
                string,
                unknown
              >
            )
          : undefined;

      const committer =
        commitData.committer &&
        typeof commitData.committer === "object"
          ? (
              commitData.committer as Record<
                string,
                unknown
              >
            )
          : undefined;

      return {
        sha: String(commit.sha ?? ""),
        message: String(commitData.message ?? ""),
        htmlUrl:
          typeof commit.html_url === "string"
            ? commit.html_url
            : undefined,
        author: author
          ? {
              name:
                typeof author.name === "string"
                  ? author.name
                  : undefined,
              email:
                typeof author.email === "string"
                  ? author.email
                  : undefined,
              date:
                typeof author.date === "string"
                  ? author.date
                  : undefined,
            }
          : undefined,
        committer: committer
          ? {
              name:
                typeof committer.name === "string"
                  ? committer.name
                  : undefined,
              email:
                typeof committer.email === "string"
                  ? committer.email
                  : undefined,
              date:
                typeof committer.date === "string"
                  ? committer.date
                  : undefined,
            }
          : undefined,
      };
    });
  }

  async listPullRequests(
    owner: string,
    repository: string,
    options: {
      state?: "open" | "closed" | "all";
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubPullRequest[]> {
    const params = new URLSearchParams();

    params.set(
      "state",
      options.state ?? "open"
    );

    if (options.perPage) {
      params.set(
        "per_page",
        String(
          Math.min(
            Math.max(options.perPage, 1),
            100
          )
        )
      );
    }

    if (options.page) {
      params.set(
        "page",
        String(Math.max(options.page, 1))
      );
    }

    const data = await this.request<
      Array<Record<string, unknown>>
    >(
      `/repos/${encodePathSegment(owner)}/${encodePathSegment(
        repository
      )}/pulls?${params.toString()}`
    );

    return data.map((item) => {
      const head =
        item.head &&
        typeof item.head === "object"
          ? (item.head as Record<string, unknown>)
          : {};

      const base =
        item.base &&
        typeof item.base === "object"
          ? (item.base as Record<string, unknown>)
          : {};

      return {
        id: Number(item.id),
        number: Number(item.number),
        title: String(item.title ?? ""),
        body:
          typeof item.body === "string"
            ? item.body
            : null,
        state:
          item.state === "closed"
            ? "closed"
            : "open",
        draft: Boolean(item.draft),
        merged: Boolean(item.merged),
        htmlUrl: String(item.html_url ?? ""),
        head: {
          ref: String(head.ref ?? ""),
          sha:
            typeof head.sha === "string"
              ? head.sha
              : undefined,
        },
        base: {
          ref: String(base.ref ?? ""),
          sha:
            typeof base.sha === "string"
              ? base.sha
              : undefined,
        },
        createdAt:
          typeof item.created_at === "string"
            ? item.created_at
            : undefined,
        updatedAt:
          typeof item.updated_at === "string"
            ? item.updated_at
            : undefined,
      };
    });
  }

  async createPullRequest(
    owner: string,
    repository: string,
    input: CreatePullRequestInput
  ): Promise<GitHubPullRequest> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/repos/${encodePathSegment(owner)}/${encodePathSegment(
        repository
      )}/pulls`,
      {
        method: "POST",
        body: {
          title: ensureNonEmpty(
            input.title,
            "Pull request title"
          ),
          head: ensureNonEmpty(
            input.head,
            "Pull request head branch"
          ),
          base: ensureNonEmpty(
            input.base,
            "Pull request base branch"
          ),
          body: input.body,
          draft: input.draft ?? false,
        },
      }
    );

    return (await this.listPullRequests(
      owner,
      repository,
      { state: "all", perPage: 1 }
    )).find(
      (pr) => pr.number === Number(data.number)
    ) as GitHubPullRequest;
  }

  async listIssues(
    owner: string,
    repository: string,
    options: {
      state?: "open" | "closed" | "all";
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();

    params.set(
      "state",
      options.state ?? "open"
    );

    if (options.perPage) {
      params.set(
        "per_page",
        String(
          Math.min(
            Math.max(options.perPage, 1),
            100
          )
        )
      );
    }

    if (options.page) {
      params.set(
        "page",
        String(Math.max(options.page, 1))
      );
    }

    const data = await this.request<
      Array<Record<string, unknown>>
    >(
      `/repos/${encodePathSegment(owner)}/${encodePathSegment(
        repository
      )}/issues?${params.toString()}`
    );

    return data
      .filter((item) => !("pull_request" in item))
      .map((item) => {
        const labels = Array.isArray(item.labels)
          ? item.labels
              .map((label) => {
                if (
                  typeof label === "object" &&
                  label
                ) {
                  const record =
                    label as Record<string, unknown>;

                  return typeof record.name ===
                    "string"
                    ? record.name
                    : "";
                }

                return "";
              })
              .filter(Boolean)
          : [];

        return {
          id: Number(item.id),
          number: Number(item.number),
          title: String(item.title ?? ""),
          body:
            typeof item.body === "string"
              ? item.body
              : null,
          state:
            item.state === "closed"
              ? "closed"
              : "open",
          htmlUrl: String(item.html_url ?? ""),
          comments:
            typeof item.comments === "number"
              ? item.comments
              : undefined,
          labels,
          createdAt:
            typeof item.created_at === "string"
              ? item.created_at
              : undefined,
          updatedAt:
            typeof item.updated_at === "string"
              ? item.updated_at
              : undefined,
        };
      });
  }

  async createIssue(
    owner: string,
    repository: string,
    input: CreateIssueInput
  ): Promise<GitHubIssue> {
    const data = await this.request<
      Record<string, unknown>
    >(
      `/repos/${encodePathSegment(owner)}/${encodePathSegment(
        repository
      )}/issues`,
      {
        method: "POST",
        body: {
          title: ensureNonEmpty(
            input.title,
            "Issue title"
          ),
          body: input.body,
          labels: input.labels,
          assignees: input.assignees,
        },
      }
    );

    return {
      id: Number(data.id),
      number: Number(data.number),
      title: String(data.title ?? ""),
      body:
        typeof data.body === "string"
          ? data.body
          : null,
      state:
        data.state === "closed"
          ? "closed"
          : "open",
      htmlUrl: String(data.html_url ?? ""),
      comments:
        typeof data.comments === "number"
          ? data.comments
          : undefined,
      labels: [],
      createdAt:
        typeof data.created_at === "string"
          ? data.created_at
          : undefined,
      updatedAt:
        typeof data.updated_at === "string"
          ? data.updated_at
          : undefined,
    };
  }

  async createIssueComment(
    owner: string,
    repository: string,
    issueNumber: number,
    input: CreateCommentInput
  ): Promise<void> {
    if (
      !Number.isInteger(issueNumber) ||
      issueNumber <= 0
    ) {
      throw new GitHubIntegrationError(
        "Issue number must be a positive integer.",
        {
          code: "VALIDATION_ERROR",
        }
      );
    }

    await this.request(
      `/repos/${encodePathSegment(owner)}/${encodePathSegment(
        repository
      )}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        body: {
          body: ensureNonEmpty(
            input.body,
            "Comment body"
          ),
        },
      }
    );
  }

  async searchRepositories(
    query: string,
    options: {
      sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
      order?: "asc" | "desc";
      perPage?: number;
      page?: number;
    } = {}
  ): Promise<
    GitHubSearchResult<GitHubRepository>
  > {
    const params = new URLSearchParams();

    params.set(
      "q",
      ensureNonEmpty(
        query,
        "Repository search query"
      )
    );

    if (options.sort) {
      params.set("sort", options.sort);
    }

    if (options.order) {
      params.set("order", options.order);
    }

    if (options.perPage) {
      params.set(
        "per_page",
        String(
          Math.min(
            Math.max(options.perPage, 1),
            100
          )
        )
      );
    }

    if (options.page) {
      params.set(
        "page",
        String(Math.max(options.page, 1))
      );
    }

    const data = await this.request<{
      total_count?: number;
      incomplete_results?: boolean;
      items?: Array<Record<string, unknown>>;
    }>(
      `/search/repositories?${params.toString()}`
    );

    return {
      totalCount: Number(data.total_count ?? 0),
      incompleteResults: Boolean(
        data.incomplete_results
      ),
      items: Array.isArray(data.items)
        ? data.items.map(mapRepository)
        : [],
    };
  }
}

export function createGitHubService(
  credentials: GitHubCredentials
): GitHubService {
  return new GitHubService(credentials);
}

export default GitHubService;