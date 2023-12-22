import React, { useState, createContext, useContext, useEffect } from "react";
import { usePolyfire } from "../hooks";

export interface PaywallRootProps {
    children?: React.JSX.Element | (React.JSX.Element | string)[] | string;
    paymentLink: string;
}
export interface PaywallAuthorizedProps {
    children?: React.JSX.Element | (React.JSX.Element | string)[] | string;
}
export interface PaywallNotAuthorizedProps {
    children?: React.JSX.Element | (React.JSX.Element | string)[] | string;
}
export interface PaywallLoadingProps {
    children?: React.JSX.Element | (React.JSX.Element | string)[] | string;
}
export interface PaywallPaymentLinkProps extends React.HTMLAttributes<HTMLElement> {
    children?: React.JSX.Element | (React.JSX.Element | string)[] | string;
}

const PaywallContext = createContext<{
    status: "loading" | "paywall" | "no-paywall";
    userId?: string;
    paymentLinkBase?: string;
}>({ status: "loading" });

export const Paywall = {
    Root({ children, paymentLink }: PaywallRootProps): React.ReactElement {
        const {
            auth: {
                status,
                user: { getAuthID, usage },
            },
        } = usePolyfire();

        const [paywallStatus, setPaywallStatus] = useState<"loading" | "paywall" | "no-paywall">(
            "loading",
        );
        const [userId, setUserId] = useState<string>();

        useEffect(() => {
            if (status === "authenticated") {
                const updateUsage = async () => {
                    const userId = await getAuthID();
                    setUserId(userId);

                    const userUsage = await usage();
                    if (userUsage.rateLimit === undefined || userUsage.rateLimit === null) {
                        setPaywallStatus("no-paywall");
                    } else {
                        setPaywallStatus(
                            userUsage.rateLimit <= userUsage.usage ? "paywall" : "no-paywall",
                        );
                    }
                };

                updateUsage();
            }
        }, [status, getAuthID, usage]);

        return (
            <PaywallContext.Provider
                value={{ status: paywallStatus, userId, paymentLinkBase: paymentLink }}
            >
                {children}
            </PaywallContext.Provider>
        );
    },

    Authorized({ children }: PaywallAuthorizedProps): React.ReactElement | null {
        const { status } = useContext(PaywallContext);

        if (status === "no-paywall") {
            return <>{children}</>;
        }

        return null;
    },

    NotAuthorized({ children }: PaywallNotAuthorizedProps): React.ReactElement | null {
        const { status } = useContext(PaywallContext);

        if (status === "paywall") {
            return <>{children}</>;
        }

        return null;
    },

    Loading({ children }: PaywallLoadingProps): React.ReactElement | null {
        const { status } = useContext(PaywallContext);

        if (status === "loading") {
            return <>{children}</>;
        }

        return null;
    },

    PaymentLink({ children, ...props }: PaywallPaymentLinkProps): React.ReactElement {
        const { paymentLinkBase, userId } = useContext(PaywallContext);

        return (
            <a
                {...props}
                href={`${paymentLinkBase}?client_reference_id=${encodeURIComponent(userId || "")}`}
            >
                {children}
            </a>
        );
    },
};
