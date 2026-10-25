# REST API v1

The API uses the same Auth.js browser session and current agency membership as
the web application. It is not an API-key integration API. Send requests to the
same origin as the app, with its session cookie. Mutation requests require an
`Origin` header equal to `APP_URL` and `Content-Type: application/json`.
JSON bodies are limited to 64 KiB. Browser forms use the same core services.

| Method | Path                                     | Behavior                                |
| ------ | ---------------------------------------- | --------------------------------------- |
| GET    | `/api/v1/workspaces`                     | List agencies for the signed-in account |
| POST   | `/api/v1/workspaces`                     | Create agency and owner membership      |
| GET    | `/api/v1/workspaces/{agencyId}/clients`  | List agency clients                     |
| GET    | `/api/v1/workspaces/{agencyId}/projects` | List agency projects                    |
| GET    | `/api/v1/workspaces/{agencyId}/tasks`    | List agency tasks                       |
| GET    | A resource collection plus `/{recordId}` | Read an authorized record               |
| POST   | A resource collection                    | Create a record                         |
| PUT    | A resource collection plus `/{recordId}` | Replace editable fields                 |
| DELETE | A resource collection plus `/{recordId}` | Delete; supply JSON `{}`                |

GET/PUT return `{ "data": ... }`; creation returns that envelope with HTTP 201;
delete returns HTTP 204. Errors use `{ "error": { "code": ..., "message": ... } }`.
HTTP 401 means no session; 404 conceals unavailable/forbidden resources; 400 means
validation failure; 409 means a conflict. No cross-agency identifiers are accepted.
The current collections are unpaginated and intended for normal agency-sized
workspaces, not bulk ingestion.

Agency input: `name`, optional `slug`.
Client input: `name`, optional `email`, `company`, `notes`.
Project input: `name`, optional `description`, `clientId`, `status`, `budget`,
`dueDate`. Budget is a decimal dollar string such as `"1250.99"`; stored values
are integer cents. Dates are `YYYY-MM-DD` or empty/null. Project status is
`PLANNED`, `ACTIVE`, `REVIEW`, `COMPLETED`, or `ARCHIVED`.
Task input: `title`, `projectId`, optional `description`, `assigneeId`, `status`,
`priority`, `dueDate`. Task status is `TODO`, `IN_PROGRESS`, or `DONE`; priority is
`LOW`, `NORMAL`, or `HIGH`. PUT uses the full editable representation; omitted
optional fields take the same defaults as creation.

Owners/admins manage clients/projects. Members can create tasks and edit tasks
they created or are assigned; they can assign only to themselves. Only managers
or a task creator can delete a task. Deleting a project deletes its tasks/comments
and file metadata. A client with projects cannot be deleted until those projects
are reassigned or deleted. Moving a project to another client withdraws all shared
deliverables and clears old review feedback.

If email is enabled, the account must be verified. If paid mode is enabled, an
active/trialing subscription is required for POST/PUT resources. Deletion remains
available. Portal downloads use separate expiring/revocable bearer links and never
expose this internal REST API or private project details.
