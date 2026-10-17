use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::tally('/api/accounts', AccountsGrid::class);
});
