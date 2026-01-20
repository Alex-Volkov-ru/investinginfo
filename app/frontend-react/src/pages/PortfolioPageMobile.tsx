import { BootstrapIcon } from '../components/BootstrapIcon';

const PortfolioPageMobile = () => {
  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Инвестиции</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow text-center">
        <BootstrapIcon name="graph-up-arrow" size={48} className="text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Мобильная версия страницы инвестиций находится в разработке
        </p>
      </div>
    </div>
  );
};

export default PortfolioPageMobile;

