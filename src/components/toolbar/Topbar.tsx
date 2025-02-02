import FileControls from './FileControls';
import PlaybackControls from './PlaybackControls';
import { Container } from 'react-bootstrap';
import MarcherListModal from '../marcher/MarcherListModal';
import PageListModal from '../page/PageListModal';
import UiSettingsToolbar from './UiSettingsToolbar';
import ExportCoordinatesModal from '../exporting/ExportCoordinatesModal';
import AlignmentToolbar from './AlignmentToolbar';

function Topbar() {
    const componentClassName = 'mx-2';


    return (
        <Container fluid className="topbar p-3">
            <FileControls className={componentClassName} />
            <PlaybackControls className={componentClassName} />
            <MarcherListModal className={componentClassName} />
            <PageListModal className={componentClassName} />
            <div className='vertival-divider' />
            <UiSettingsToolbar className={componentClassName} />
            <AlignmentToolbar className={componentClassName} />
            <ExportCoordinatesModal className={componentClassName} />
        </Container>
    );
}

export default Topbar;
