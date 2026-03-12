---
description: Frontend service file conventions
paths:
  - "src/services/**/*.ts"
---

# Frontend Service Files

Services are pure functions that wrap axios calls. They live in `src/services/<domain>.service.ts` and are consumed by hooks (`useMutation`/`useQuery`).

## No async/await

Services wrap a single axios call — no need for async/await. Return the promise chain directly with `.then((r) => r.data)`. Use the axios generic type parameter for response typing.

```typescript
// WRONG
export async function login(data: LoginDto): Promise<LoginResponse> {
  const response: AxiosResponse<LoginResponse> = await axios.post(
    "cloud-api/auth/login", data, { public: true },
  );
  return response.data;
}

// CORRECT
export function login(data: LoginDto): Promise<LoginResponse> {
  return axios
    .post<LoginResponse>("cloud-api/auth/login", data, { public: true })
    .then((r) => r.data);
}
```

For void returns, use `.then(() => undefined)`.

## No AxiosResponse import

The generic type on `axios.get<T>()` / `axios.post<T>()` handles typing. No need to import `AxiosResponse`.

## `export function` for services

```typescript
// WRONG
export const login = (data: LoginDto): Promise<LoginResponse> => { ... }

// CORRECT
export function login(data: LoginDto): Promise<LoginResponse> { ... }
```

## Success messages — prefer backend over frontend

Do not pass `successMessage` in the axios config. Let the backend include `message` in the response body — the axios interceptor reads `response.data.message` automatically and shows the toast.

```typescript
// WRONG — hardcoded success message in frontend service
export function createOrganization(data: CreateOrgDto): Promise<OrgListItem> {
  return axios
    .post<OrgListItem>('cloud-api/organizations', data, { successMessage: 'Organization created successfully' })
    .then((r) => r.data);
}

// CORRECT — backend response includes { ...data, message: 'Done' }, axios handles the toast
export function createOrganization(data: CreateOrgDto): Promise<OrgListItem> {
  return axios.post<OrgListItem>('cloud-api/organizations', data).then((r) => r.data);
}
```

## TS80006 hint — expected, not an error

TypeScript may suggest "This may be converted to an async function" on service functions that return a Promise chain. This is intentional — ignore it. The no-async/await convention takes precedence.
