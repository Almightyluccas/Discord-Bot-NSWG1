import axios from 'axios';

interface Submission {
    id: number;
    form_id: number;
    user_id: number;
    created_at: string;
    updated_at: string;
    arma_3_id: string;
    discord_name: string;
    first_name: string;
    date_of_birth: string;
    email_address: string;
    previous_unit: number;
    preferred_position: string;
    why_do_you_want_to_join_red_squadron: string;
    label: string;
}

interface StatusResponse {
    data: Status[];
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        from: number;
        last_page: number;
        to: number;
        total: number;
        path: string;
        per_page: number;
        links: {
            url: string | null;
            label: string;
            active: boolean;
        }[];
    };
}

interface Status {
    id: number;
    name: string;
    color: string;
    order: number;
    created_at: string;
    updated_at: string;
    label: string;
}

export interface Form1Submission {
    first_name: string;
    discord_name: string;
    preferred_position: string;
    user_id: number;
    form_id: number;
    date_of_birth: string;
}

export interface AcceptedUsers {
    first_name: string;
    discord_name: string;
    user_id: number;
    preferred_position: string;
    form_id?: number;
    date_of_birth?: string;
}

export interface DeniedUsers {
    first_name: string;
    discord_name: string;
    user_id: number;
    preferred_position: string;
    form_id?: number;
    date_of_birth?: string;
}

export class PerscomService {
    private readonly BEARER_TOKEN: string;

    constructor(bearerToken: string) {
        this.BEARER_TOKEN = bearerToken;
    }

    public async getSubmissionStatus(
        submissions: Form1Submission[],
        statusId: number
    ): Promise<AcceptedUsers[] | DeniedUsers[]> {
        const activeUsers: AcceptedUsers[] = [];

        for (const submission of submissions) {
            const formId = submission.form_id;
            try {
                const response = await axios.get<StatusResponse>(
                    `https://api.perscom.io/v2/submissions/${formId}/statuses`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.BEARER_TOKEN}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                const statusData = response.data.data;
                if (!statusData || statusData.length === 0) {
                    continue;
                }
                const matchedStatus = statusData.find(status => status.id === statusId);
                if (matchedStatus) {
                    activeUsers.push({
                        discord_name: submission.discord_name,
                        first_name: submission.first_name,
                        user_id: submission.user_id,
                        preferred_position: submission.preferred_position,
                        form_id: submission.form_id,
                        date_of_birth: submission.date_of_birth,
                    });
                }
            } catch (error) {
                console.error(`Error fetching statuses for formId ${formId}:`, error);
            }
        }
        return activeUsers;
    }

    public async getAllForm1Data(): Promise<Form1Submission[]> {
        const allForm1Submissions: Form1Submission[] = [];
        let page = 4;
        let lastPage = 1;

        try {
            const metadataResponse = await fetch('https://api.perscom.io/v2/submissions', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.BEARER_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!metadataResponse.ok) {
                console.error(`Metadata response error: ${metadataResponse.status} ${metadataResponse.statusText}`);
                return [];
            }

            const metadata = await metadataResponse.json();
            lastPage = metadata.meta.last_page;
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return [];
        }

        while (page <= lastPage) {
            try {
                const response = await fetch(`https://api.perscom.io/v2/submissions?page=${page}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.BEARER_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error(`Error fetching submissions for page ${page}: ${response.status} ${response.statusText}`);
                    break;
                }

                const data = await response.json();
                const form1Submissions = data.data
                    .filter((submission: Submission) => submission.form_id === 1)
                    .map((submission: Submission): Form1Submission => ({
                        first_name: submission.first_name,
                        discord_name: submission.discord_name,
                        preferred_position: submission.preferred_position,
                        form_id: submission.id,
                        user_id: submission.user_id,
                        date_of_birth: submission.date_of_birth
                    }));

                allForm1Submissions.push(...form1Submissions);
                page++;
            } catch (error) {
                console.error(`Error fetching data on page ${page}:`, error);
                break;
            }
        }
        return allForm1Submissions;
    }

    public async clearCache(): Promise<void> {
        try {
            const response = await axios.post(`https://api.perscom.io/v2/cache`, null, {
                headers: {
                    'Authorization': `Bearer ${this.BEARER_TOKEN}`,
                },
            });

            if (response.status !== 200) {
                console.warn(`Cache clear responded with: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    public async deleteUsers(users: DeniedUsers[]): Promise<void> {
        for (const user of users) {
            const options = {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.BEARER_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            };

            try {
                const response = await fetch(`https://api.perscom.io/v2/users/${user.user_id}`, options);
                if (!response.ok) {
                    const errorMsg = await response.text();
                    console.error(`Failed to delete user ${user.first_name}: ${response.status} ${response.statusText} - ${errorMsg}`);
                    continue;
                }
                const data = await response.json();
                console.log(`Deleted user ${user.first_name}:`, data);
            } catch (err) {
                console.error(`Error deleting user ${user.first_name}:`, err);
            }
        }
    }
}