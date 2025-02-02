import { useCallback, useEffect } from "react";
import { useSelectedPage } from "./context/SelectedPageContext";
import { Constants } from "@/global/Constants";
import { useSelectedMarchers } from "@/context/SelectedMarchersContext";
import { useMarcherStore } from "@/stores/marcher/useMarcherStore";
import { useMarcherPageStore } from "@/stores/marcherPage/useMarcherPageStore";
import { usePageStore } from "@/stores/page/usePageStore";
import { Marcher } from "./global/classes/Marcher";
import { Page } from "./global/classes/Page";
import { MarcherPage } from "./global/classes/MarcherPage";

/**
 * A component that initializes the state of the application.
 * @returns <> </>
 */
function StateInitializer() {
    const { marchers, fetchMarchers } = useMarcherStore();
    const { fetchMarcherPages } = useMarcherPageStore()!;
    const { pages, fetchPages } = usePageStore();
    const { selectedPage, setSelectedPage } = useSelectedPage()!;
    const { setSelectedMarchers } = useSelectedMarchers()!;

    // Set the fetchMarchers function in the Marcher class and fetch marchers from the database
    useEffect(() => {
        Marcher.fetchMarchers = fetchMarchers;
        fetchMarchers();
    }, [fetchMarchers]);

    useEffect(() => {
        MarcherPage.fetchMarcherPages = fetchMarcherPages;
        fetchMarcherPages();
    }, [fetchMarcherPages, pages, marchers]);

    useEffect(() => {
        Page.fetchPages = fetchPages;
        fetchPages();
    }, [fetchPages]);

    // Select the first page if none are selected. Intended to activate at the initial loading of a webpage
    useEffect(() => {
        if (selectedPage == null && pages.length > 0)
            setSelectedPage(pages[0]);
    }, [pages, selectedPage, setSelectedPage]);

    useEffect(() => { })

    const getMarcher = useCallback((id: number) => {
        return marchers.find(marcher => marcher.id === id) || null;
    }, [marchers]);

    const getPage = useCallback((id: number) => {
        return pages.find(page => page.id === id) || null;
    }, [pages]);

    // Listen for history actions (undo/redo) from the main process
    useEffect(() => {
        const handler = (args: { tableName: string, marcher_ids: number[], page_id: number }) => {
            switch (args.tableName) {
                case Constants.MarcherTableName:
                    fetchMarchers();
                    if (args.marcher_ids.length > 0) {
                        // TODO support passing in all of the marchers that were modified in the undo
                        const newMarchers = marchers.filter(marcher => args.marcher_ids.includes(marcher.id));
                        setSelectedMarchers(newMarchers);
                    } else {
                        setSelectedMarchers([]);
                    }
                    break;
                case Constants.MarcherPageTableName:
                    fetchMarcherPages();
                    if (args.marcher_ids.length > 0) {
                        // TODO support passing in all of the marchers that were modified in the undo
                        const newMarchers = marchers.filter(marcher => args.marcher_ids.includes(marcher.id));
                        setSelectedMarchers(newMarchers);
                    } else {
                        setSelectedMarchers([]);
                    }
                    if (args.page_id > 0)
                        setSelectedPage(getPage(args.page_id));
                    break;
                case Constants.PageTableName:
                    fetchPages();
                    if (args.page_id > 0)
                        setSelectedPage(getPage(args.page_id));
                    break;
            }
            return "SUCCESS"
        };

        window.electron.onHistoryAction(handler);

        return () => {
            window.electron.removeHistoryActionListener(); // Remove the event listener
        };
    }, [getMarcher, getPage, fetchMarchers, fetchMarcherPages, fetchPages, setSelectedPage, setSelectedMarchers, marchers]);

    // Listen for fetch actions from the main process
    useEffect(() => {
        const handler = (type: 'marcher' | 'page' | 'marcher_page') => {
            switch (type) {
                case 'marcher':
                    fetchMarchers();
                    break;
                case 'page':
                    fetchPages();
                    break;
                case 'marcher_page':
                    fetchMarcherPages();
                    break;
            }
        }

        window.electron.onFetch(handler);

        return () => {
            window.electron.removeFetchListener(); // Remove the event listener
        }
    }, [fetchMarchers, fetchMarcherPages, fetchPages]);

    return <></>; // Empty fragment
}

export default StateInitializer;
